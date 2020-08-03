"use strict";
exports.__esModule = true;
var FSA;
(function (FSA) {
    var noScript = function () { };
    var Rules;
    (function (Rules) {
        var CharMatchRule = /** @class */ (function () {
            function CharMatchRule(ch, nextStates, onActivated) {
                if (onActivated === void 0) { onActivated = noScript; }
                this.ch = ch;
                if (typeof nextStates === 'string')
                    nextStates = [nextStates];
                this.nextStates = nextStates;
                this.activatedCB = onActivated;
            }
            CharMatchRule.prototype.match = function (acc, nextChar) {
                var ret = null;
                if (nextChar === this.ch) {
                    this.activatedCB(acc);
                    return this.nextStates;
                }
                return ret;
            };
            return CharMatchRule;
        }());
        Rules.CharMatchRule = CharMatchRule;
        var RegMatchRule = /** @class */ (function () {
            function RegMatchRule(ch, nextStates, onActivated) {
                if (onActivated === void 0) { onActivated = noScript; }
                this.ch = ch;
                if (typeof nextStates === 'string')
                    nextStates = [nextStates];
                this.nextStates = nextStates;
                this.activatedCB = onActivated;
            }
            RegMatchRule.prototype.match = function (acc, nextChar) {
                var ret = null;
                if (this.ch.test(nextChar)) {
                    this.activatedCB(acc, nextChar);
                    return this.nextStates;
                }
                return ret;
            };
            return RegMatchRule;
        }());
        Rules.RegMatchRule = RegMatchRule;
        var UnMatchedRule = /** @class */ (function () {
            function UnMatchedRule(nextStates, onActivated) {
                if (onActivated === void 0) { onActivated = noScript; }
                this.acc = '';
                this.ch = '';
                if (typeof nextStates === 'string')
                    nextStates = [nextStates];
                this.nextStates = nextStates;
                this.activatedCB = onActivated;
            }
            UnMatchedRule.prototype.match = function (acc, nextChar) {
                this.acc = acc;
                this.ch = nextChar;
                this.activatedCB(this.acc, this.ch);
                return this.nextStates;
            };
            return UnMatchedRule;
        }());
        Rules.UnMatchedRule = UnMatchedRule;
    })(Rules = FSA.Rules || (FSA.Rules = {}));
    var States;
    (function (States) {
        var State = /** @class */ (function () {
            function State(name, rules) {
                this.name = name;
                this.rules = rules;
                this.stateActivatedCB = noScript;
                this.stateDeactivatedCB = noScript;
                this.reset();
            }
            State.prototype.onStateActivated = function (cb) {
                this.stateActivatedCB = cb;
            };
            State.prototype.onStateDeactivated = function (cb) {
                this.stateDeactivatedCB = cb;
            };
            State.prototype.reset = function () {
                this.acc = '';
            };
            State.prototype.addRule = function (rule) {
                this.rules.push(rule);
            };
            State.prototype.parse = function (char) {
                var nextStates = null;
                var unmatchedRules = null;
                for (var i = 0; i < this.rules.length; i++) {
                    var rule1 = this.rules[i];
                    // if rule is unmatched rule then save it for later check an continue;
                    if (rule1 instanceof Rules.UnMatchedRule) {
                        if (unmatchedRules === null)
                            unmatchedRules = [];
                        unmatchedRules.push(rule1);
                        continue;
                    }
                    // check with other rules;
                    var nextStates1 = rule1.match(this.acc, char);
                    if (nextStates1 !== null) {
                        if (nextStates === null)
                            nextStates = [];
                        nextStates.push.apply(nextStates, nextStates1);
                    }
                }
                // if unmatched rules exists and no other rules matched
                if (nextStates === null && unmatchedRules !== null) {
                    for (var i = 0; i < unmatchedRules.length; i++) {
                        var rule1 = unmatchedRules[i];
                        // check with other rules;
                        var nextStates1 = rule1.match(this.acc, char);
                        if (nextStates1 !== null) {
                            if (nextStates === null)
                                nextStates = [];
                            nextStates.push.apply(nextStates, nextStates1);
                        }
                    }
                }
                return nextStates;
            };
            State.prototype.stateEntered = function () {
                this.stateActivatedCB(this);
                this.reset();
            };
            State.prototype.stateExited = function () {
                this.stateDeactivatedCB(this);
            };
            return State;
        }());
        States.State = State;
    })(States = FSA.States || (FSA.States = {}));
    var Graph = /** @class */ (function () {
        function Graph() {
            this.nameToState = {};
            this.currentStates = [];
            this.initStates = [];
            this.nextStates = [];
            this.reset();
        }
        Graph.prototype.reset = function () {
            var _this = this;
            this.graphIsReset = true;
            this.currentStates = [];
            this.initStates.forEach(function (st) { _this.currentStates.push(st); });
        };
        Graph.prototype.initialState = function (state) {
            if (!this.graphIsReset)
                throw "Cannot init after graph has begun parsing. Reset graph to modify initial states.";
            this.initStates.push(state);
            this.addState(state);
            this.currentStates.push(state);
        };
        Graph.prototype.addState = function (state) {
            this.nameToState[state.name] = state;
        };
        Graph.prototype.parse = function (char) {
            var _this = this;
            if (this.graphIsReset) {
                // set graph reset flag
                this.graphIsReset = false;
                // let initial states know that states have entered
                for (var i = 0; i < this.currentStates.length; i++) {
                    var stateiq = this.currentStates[i];
                    stateiq.stateEntered();
                }
            }
            // init new states from last cycle;
            this.nextStates.forEach(function (state) {
                _this.currentStates.push(state);
                // trigger new state event;
                state.stateEntered();
            });
            this.nextStates = [];
            // state parse result accumulator
            var remStates = [];
            // parse each state;
            for (var i = 0; i < this.currentStates.length; i++) {
                var stateiq = this.currentStates[i];
                var nextStates = stateiq.parse(char);
                if (nextStates !== null) {
                    // Get state Objs from state names
                    var nextStateObj = nextStates.map(function (stateName) { return _this.nameToState[stateName]; });
                    // Add state obj to be in scene for next state
                    this.nextStates.push.apply(this.nextStates, nextStateObj);
                    remStates.push(stateiq);
                }
            }
            // remove old states
            remStates.forEach(function (state) {
                var stateIndex = _this.currentStates.indexOf(state);
                if (stateIndex >= 0)
                    _this.currentStates.splice(stateIndex, 1);
                else
                    throw "state " + state + " should have been a member of existing states";
                // call exited status;
                state.stateExited();
            });
            // next States are init at next char;
        };
        return Graph;
    }());
    FSA.Graph = Graph;
})(FSA || (FSA = {}));
exports["default"] = FSA;
