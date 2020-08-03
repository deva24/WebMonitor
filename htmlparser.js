"use strict";
exports.__esModule = true;
var fsa_1 = require("./fsa");
function tagDifference(txt) {
    var inTag = false;
    var graph = new fsa_1["default"].Graph();
    var isHighlighting = 0;
    function prepGraph() {
        var preState = new fsa_1["default"].States.State('pre', [new fsa_1["default"].Rules.CharMatchRule('<', 'openTagBegin', function () { inTag = true; })]);
        preState.onStateActivated(function () { inTag = false; });
        graph.initialState(preState);
        graph.addState(new fsa_1["default"].States.State('openTagBegin', [
            new fsa_1["default"].Rules.CharMatchRule('>', 'pre'),
            new fsa_1["default"].Rules.CharMatchRule('"', 'dblQtBegin'),
            new fsa_1["default"].Rules.CharMatchRule("'", 'sngQtBegin'),
        ]));
        graph.addState(new fsa_1["default"].States.State('dblQtBegin', [
            new fsa_1["default"].Rules.CharMatchRule('"', 'openTagBegin'),
            new fsa_1["default"].Rules.CharMatchRule('\\', 'dblQtEscape'),
        ]));
        graph.addState(new fsa_1["default"].States.State('dblQtEscape', [
            new fsa_1["default"].Rules.UnMatchedRule('dblQtBegin')
        ]));
        graph.addState(new fsa_1["default"].States.State('sngQtBegin', [
            new fsa_1["default"].Rules.CharMatchRule("'", 'openTagBegin'),
            new fsa_1["default"].Rules.CharMatchRule('\\', 'sngQtEscape'),
        ]));
        graph.addState(new fsa_1["default"].States.State('sngQtEscape', [
            new fsa_1["default"].Rules.UnMatchedRule('sngQtBegin')
        ]));
    }
    prepGraph();
    var acc1 = '';
    txt.forEach(function (element) {
        var chars = element[0];
        var highLight = element[1];
        for (var i = 0; i < chars.length; i++) {
            var ch = chars.charAt(i);
            graph.parse(ch);
            //console.log('ch = ', ch);
            //console.log('st = [ ' + graph.currentStates.map(x => x.name).join(',') + ' ]');
            var shouldHighlight = highLight;
            if (inTag)
                shouldHighlight = 0;
            if (shouldHighlight !== isHighlighting) {
                if (isHighlighting === 1)
                    acc1 += '</ins>';
                else if (isHighlighting === -1)
                    acc1 += '</del>';
                if (shouldHighlight === 1)
                    acc1 += '<ins>';
                else if (shouldHighlight === -1)
                    acc1 += '<del>';
                isHighlighting = shouldHighlight;
            }
            acc1 += ch;
        }
    });
    return acc1;
}
exports["default"] = tagDifference;
