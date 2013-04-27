CloudPebble.Editor.PebbleMode = {
    name: 'clike',
    useCPP: true,
    keywords: {
        // C
        'auto': true,
        'if': true,
        'break': true,
        'int': true,
        'case': true,
        'long': true,
        'char': true,
        'register': true,
        'continue': true,
        'return': true,
        'default': true,
        'short': true,
        'do': true,
        'sizeof': true,
        'double': true,
        'static': true,
        'else': true,
        'struct': true,
        'entry': true,
        'switch': true,
        'extern': true,
        'typedef': true,
        'float': true,
        'union': true,
        'for': true,
        'unsigned': true,
        'goto': true,
        'while': true,
        'enum': true,
        'void': true,
        'const': true,
        'signed': true,
        'volatile': true,
        // Pebble-specific
        'Layer': true,
        'Animation': true,
        'ScrollLayer': true,
        'MenuLayer': true,
        'NumberWindow': true,
        'GContext': true,
        'GPoint': true,
        'GSize': true,
        'GRect': true,
        'TRIG_MAX_RATIO': true,
        'TRIG_MAX_ANGLE': true,
        'ANIMATION_NORMALIZED_MIN': true,
        'ANIMATION_NORMALIZED_MAX': true,
        'ARRAY_LENGTH': true,
        'IS_SIGNED': true,
        'AnimationCurve': true,
        'AnimationHandlers': true,
        'Window': true,
        'TextLayer': true,
        'BmpContainer': true,
        'AppTimerHandle': true,
        'time_t': true,
        'GFont': true,
        'GColor': true,
        'AppContextRef': true,
        'ClickRecognizerRef': true,
        'PropertyAnimation': true,
        'ClickConfig': true,
        'ClickHandler': true
        // Lots more to add.
    }
};
//var browserHeight = document.documentElement.clientHeight;
//code_mirror.getWrapperElement().style.height = (browserHeight - 130) + 'px';
//code_mirror.refresh();
//code_mirror.refresh();
//code_mirror.on('cursorActivity', function() {
//    code_mirror.matchHighlight('CodeMirror-matchhighlight');
//})