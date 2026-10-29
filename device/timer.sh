#!/bin/sh
# Runs on the Kindle. No Mac connection is needed after launch.
. /mnt/us/firepace/settings
FB=/mnt/us/usbnet/bin/fbink
ASSETS=/mnt/us/firepace/assets
CARD_DIR=$ASSETS
preset=-1
if [ -s /mnt/us/firepace/last-preset ]; then
 preset=$(cat /mnt/us/firepace/last-preset)
 if [ -f /mnt/us/firepace/presets/$preset/settings ]; then
  CARD_DIR=/mnt/us/firepace/presets/$preset
  . "$CARD_DIR/settings"
 else preset=-1; fi
fi
echo $$ > /tmp/firepace.pid
if [ -s /mnt/us/firepace/rotation ]; then ROTATION=$(cat /mnt/us/firepace/rotation); fi
case "$ROTATION" in 1|3) WIDTH=800; HEIGHT=600;; *) WIDTH=600; HEIGHT=800;; esac
key_pids=''
key_readers=''
listen_keys() {
 event=$1
 fifo=/tmp/firepace-keys$event
 rm -f "$fifo"; mkfifo "$fifo"
 /mnt/us/usbnet/bin/evtest --grab /dev/input/event$event > "$fifo" 2>/dev/null &
 key_pids="$key_pids $!"
 while IFS= read -r line; do
  case "$line" in
   *EV_KEY*'value 1')
    action=''
    case "$line" in
     *KEY_HOME*) action=exit;;
     *KEY_MENU*) action=menu;;
     *KEY_BACK*) action=back;;
     *KEY_F24*) action=select;;
     *KEY_DOWN*|*KEY_RIGHT*|*KEY_PAGEDOWN*|*KEY_F23*) action=next;;
     *KEY_UP*|*KEY_LEFT*|*KEY_PAGEUP*|*KEY_F21*) action=previous;;
    esac
    [ -n "$action" ] && { printf '%s' "$action" > /tmp/firepace-action.key; mv /tmp/firepace-action.key /tmp/firepace-action; }
   ;;
  esac
 done < "$fifo" &
 key_readers="$key_readers $!"
}
old_sleep=$(/usr/bin/lipc-get-prop com.lab126.powerd preventScreenSaver)
cleanup() {
 kill $key_pids $key_readers 2>/dev/null
 rm -f /tmp/firepace-keys0 /tmp/firepace-keys1
 /mnt/us/usbnet/bin/fbdepth -q -r 0
 [ "$old_sleep" = 0 ] && /usr/bin/lipc-set-prop com.lab126.powerd preventScreenSaver 0
 printf '{"running":false}\n' > /tmp/firepace-state
 rm -f /tmp/firepace.pid
 /mnt/us/usbnet/bin/evemu-event /dev/input/event0 --type EV_KEY --code KEY_HOME --value 1 --sync 2>/dev/null
 /mnt/us/usbnet/bin/evemu-event /dev/input/event0 --type EV_KEY --code KEY_HOME --value 0 --sync 2>/dev/null
}
trap cleanup EXIT
trap 'exit 0' TERM INT
trap '' HUP
/usr/bin/lipc-set-prop com.lab126.powerd preventScreenSaver 1
/mnt/us/usbnet/bin/fbdepth -q -r "$ROTATION"
listen_keys 0
listen_keys 1
menu=0
selection=0
phase=focus
paused=0
base=$DURATION
started=$(date +%s)
remaining=$base
elapsed=0
full=1
last=''
previous_menu=0
while :; do
 now=$(date +%s)
 if [ -f /tmp/firepace-action ]; then
  action=$(cat /tmp/firepace-action)
  rm -f /tmp/firepace-action
  if [ "$menu" = 3 ]; then
   case "$action" in
    next) selection=$(((selection+1)%4)); full=1; action='';;
    previous) selection=$(((selection+3)%4)); full=1; action='';;
    select) case "$selection" in 0) action=rotate3;; 1) action=rotate1;; 2) action=rotate0;; 3) action=rotate2;; esac; menu=0;;
    back|menu) menu=0; full=1; action='';;
   esac
  fi
  if [ "$menu" = 2 ]; then
   total=$(cat /mnt/us/firepace/presets/count 2>/dev/null)
   [ -z "$total" ] && total=0
   case "$action" in
    next) selection=$(((selection+1)%total)); full=1; action='';;
    previous) selection=$(((selection+total-1)%total)); full=1; action='';;
    select)
     preset=$selection
     printf '%s' "$preset" > /mnt/us/firepace/last-preset
     CARD_DIR=/mnt/us/firepace/presets/$preset
     saved_rotation=$ROTATION
     . "$CARD_DIR/settings"
     ROTATION=$saved_rotation
     case "$ROTATION" in 1|3) WIDTH=800; HEIGHT=600;; *) WIDTH=600; HEIGHT=800;; esac
     /mnt/us/usbnet/bin/fbdepth -q -r "$ROTATION"
     phase=focus; base=$DURATION; started=$now; elapsed=0; remaining=$base; paused=0; menu=0; full=1; action='';;
    back|menu) menu=0; full=1; action='';;
   esac
  fi
  case "$action" in
   menu) menu=$((1-menu)); full=1;;
   back) if [ "$menu" = 1 ]; then menu=0; full=1; else action=exit; fi;;
   next) if [ "$menu" = 1 ]; then selection=$(((selection+1)%7)); full=1; else action=skip; fi;;
   previous) if [ "$menu" = 1 ]; then selection=$(((selection+6)%7)); full=1; else action=restart; fi;;
   select) if [ "$menu" = 1 ]; then
    case "$selection" in 0) action=toggle;; 1) action=restart;; 2) action=skip;; 3) action=presets;; 4) action=orientation;; 5) action=refresh;; 6) action=exit;; esac
    menu=0; full=1
   else action=toggle; fi;;
  esac
  [ "$action" = toggle ] && { if [ "$paused" = 1 ]; then action=resume; else action=pause; fi; }
  case "$action" in
   orientation) menu=3; selection=0; full=1;;
   rotate0|rotate1|rotate2|rotate3)
    ROTATION=${action#rotate}
    printf '%s' "$ROTATION" > /mnt/us/firepace/rotation
    case "$ROTATION" in 1|3) WIDTH=800; HEIGHT=600;; *) WIDTH=600; HEIGHT=800;; esac
    /mnt/us/usbnet/bin/fbdepth -q -r "$ROTATION"
    full=1;;
   presets) if [ -s /mnt/us/firepace/presets/count ]; then menu=2; selection=0; full=1; fi;;
   pause) paused=1;;
   resume) started=$((now-elapsed)); paused=0;;
   restart) elapsed=0; started=$now; remaining=$base; full=1;;
   skip) if [ "$phase" = focus ]; then phase=break; base=$BREAK_SECONDS; else phase=focus; base=$DURATION; fi; elapsed=0; started=$now; full=1;;
   refresh) full=1;;
   exit) $FB -q -f -c; exit 0;;
  esac
 fi
 if [ "$paused" = 0 ]; then elapsed=$((now-started)); fi
 remaining=$((base-elapsed))
 if [ "$COUNT_UP" = 0 ] && [ "$remaining" -le 0 ]; then
  if [ "$phase" = focus ]; then phase=break; base=$BREAK_SECONDS; else phase=focus; base=$DURATION; fi
  started=$now; elapsed=0; remaining=$base; full=1
 fi
 if [ "$COUNT_UP" = 1 ]; then value=$elapsed; else value=$remaining; fi
 minutes=$((value/60)); seconds=$((value%60))
 clock=$(printf '%02d:%02d' "$minutes" "$seconds")
 progress=$((remaining*20/base)); [ "$COUNT_UP" = 1 ] && progress=$(((elapsed%60)*20/60)); [ "$progress" -lt 0 ] && progress=0; [ "$progress" -gt 20 ] && progress=20
 if [ "$menu" != 0 ]; then
  if [ "$full" = 1 ]; then
   if [ "$menu" = 2 ]; then image=/mnt/us/firepace/presets/menu$selection.pgm; elif [ "$menu" = 3 ]; then image=$ASSETS/rotate$selection.pgm; else image=$ASSETS/menu$selection.pgm; fi
   $FB -q -b -k
   $FB -q -b -g file="$image",x=$(((WIDTH-600)/2)),y=$(((HEIGHT-600)/2))
   if [ "$previous_menu" != "$menu" ]; then $FB -q -f -s; else $FB -q -s; fi
   previous_menu=$menu
   full=0; last=''
  fi
 elif [ "$full" = 1 ]; then
  previous_menu=0
  case "$ROTATION" in 1|3) shape=landscape;; *) shape=portrait;; esac
  $FB -q -b -g file="$CARD_DIR/$phase$shape.pgm"
 fi
 if [ "$menu" = 0 ] && [ "$clock:$paused:$full" != "$last" ]; then
  top=$((HEIGHT-132))
  $FB -q -b -k top=$top,left=0,width=$WIDTH,height=132
  [ "$paused" = 1 ] && $FB -q -b -g file="$ASSETS/paused.pgm",x=32,y=$top
  len=${#clock}; labelwidth=0
  [ "$COUNT_UP" = 0 ] && labelwidth=48
  x=$((WIDTH-32-labelwidth-(len-1)*DIGIT_WIDTH-23)); startx=$x
  rest=$clock
  while [ -n "$rest" ]; do
   char=${rest%"${rest#?}"}; rest=${rest#?}
   [ "$char" = : ] && char=colon
   $FB -q -b -g file="$ASSETS/d$char.pgm",x=$x,y=$top
   if [ "$char" = colon ]; then x=$((x+23)); else x=$((x+DIGIT_WIDTH)); fi
  done
  [ "$COUNT_UP" = 0 ] && $FB -q -b -g file="$ASSETS/left.pgm",x=$x,y=$top
  px=$((startx-62)); py=$((top+40))
  $FB -q -b -g file="$ASSETS/p$progress.pgm",x=$px,y=$py
  if [ "$full" = 1 ]; then $FB -q -f -s; else $FB -q -s top=$top,left=0,width=$WIDTH,height=132; fi
  last="$clock:$paused:0"; full=0
 fi
 printf '{"running":true,"remaining":%s,"elapsed":%s,"phase":"%s","paused":%s,"preset":%s,"rotation":%s}\n' "$remaining" "$elapsed" "$phase" "$paused" "$preset" "$ROTATION" > /tmp/firepace-state.new
 mv /tmp/firepace-state.new /tmp/firepace-state
 usleep 100000
done
