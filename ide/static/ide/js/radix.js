/*
The MIT License

Copyright (c) 2008 Javid Jamae

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

/**
 * Author: Javid Jamae
 * Website: http://www.javidjamae.com/
 */

(function() {
    function RadixTree() {
        this.rootNode = new RadixTreeNode("", true);

        this.insert = function(key, value) {
            this._insertInternal(key, this.rootNode, value);
        };

        this._insertInternal= function(key, node, value) {
            if (node.isStringSubNode(key)) {
                this._addNodeOrRecurse(key, node, value);
            } else if (key == node.getKey()) {
                this._makeNodeDataNode(key, node, value);
            } else if (node.isStringPartialMatch(key)) {
                this._splitNode(key, node, value);
            } else {
                this._addNodeAsChild(key, node, value);
            }
        };

        this._addNodeOrRecurse = function(key, node, value) {
            var addedToChild = false;
            var newText = node.getMatchingPortionOfString(key);
            for (var j = 0; j<node.getChildren().length; j++) {
                if (node.getChildren()[j].getKey().startsWith(newText.charAt(0))) {
                    addedToChild = true;
                    this._insertInternal(newText, node.getChildren()[j], value);
                    break;
                }
            }

            if (addedToChild === false) {
                var n = new RadixTreeNode(newText);
                n.setReal(true);
                n.setValue(value);
                node.addChild(n);
            }
        };

        this._makeNodeDataNode = function(key, node, value) {
            if (node.getIsReal()) {
                throw "Duplicate key";
            }
            node.setReal(true);
            node.setValue(value);
        };

        this._addNodeAsChild = function(key, node, value) {
            alert("This doesn't ever seem to be called. If you see this alert, you just found a case where it is. You now have reason to remove this alert.");
            var n = node.deepCopy();
            n.setKey(node.getMatchingPortionOfNodeKey(key));
            node.setKey(key);
            node.setReal(true);
            node.setValue(value);
            node.addChild(n);
        };

        this._splitNode = function(key, node, value) {
            var n1 = node.deepCopy();
            n1.setKey(node.getMatchingPortionOfNodeKey(key));
            node.setKey(node.getUnmatchingPortionOfString(key));
            node.setReal(false);
            node.clearChildren();
            node.addChild(n1);

            if(node.getNumberOfMatchingCharacters(key) < key.length) {
                var n2 = new RadixTreeNode();
                n2.setKey(node.getMatchingPortionOfString(key));
                n2.setReal(true);
                n2.setValue(value);

                node.addChild(n2);
            } else {
                node.setValue(value);
                node.setReal(true);
            }
        };

        /**
         * searchString - Any string to search for
         * limit - the number of results to find before returning
         */
        this.search = function(searchString, recordLimit) {
            var visitor = new Visitor();

            visitor.result = [];

            visitor.visit = function(key, parent, node) {
                if (node.getIsReal()) {
                    this.result.push(node.value);
                }
            };
            visitor.shouldVisit = function(key, node) {
                return node.getKey().startsWith(key) && this.result.length < recordLimit;
            };
            visitor.shouldRecurse = function(key, node){
                return this.result.length < recordLimit;
            };
            visitor.shouldVisitChild = function(key, childNode) {
                return childNode.getKey().startsWith(key.charAt(0)) && this.result.length < recordLimit;
            };

            this.visit(searchString, visitor);

            return visitor.result;
        };

        this.find = function(key) {
            var visitor = new Visitor();
            visitor.visit = function(key, parent, node) {
                if (node.getIsReal()) {
                    this.result = node.value;
                }
            };
            visitor.shouldVisit = function(key, node) {
                return key == node.getKey();
            };
            visitor.shouldRecurse = function(key, node){
                return node.isStringSubNode(key);
            };
            visitor.shouldVisitChild = function(key, childNode) {
                return childNode.getKey().startsWith(key.charAt(0));
            };
            this.shouldBreakAfterFindingChild = function() {
                return true;
            };

            this.visit(key, visitor);
            return visitor.result;
        };

        this.visit = function(key, visitor) {
            this._visitInternal(key, visitor, null, this.rootNode);
        };

        this._visitInternal = function(prefix, visitor, parent, node) {
            if (visitor.shouldVisit(prefix, node)) {
                visitor.visit(prefix, parent, node);
            }
            if (visitor.shouldRecurse(prefix, node)) {
                var newText = node.getMatchingPortionOfString(prefix);
                for (var j = 0; j < node.getChildren().length; j++) {
                    // recursively search the child nodes
                    if (visitor.shouldVisitChild(newText, node.getChildren()[j])) {
                        this._visitInternal(newText, visitor, node, node.getChildren()[j]);
                        if (visitor.shouldBreakAfterFindingChild()) {
                            break;
                        }
                    }
                }
            }
        };

        this.getNumberOfRealNodes = function() {
            var visitor = new Visitor();
            visitor.result = 0;

            visitor.visit = function(key, parent, node) {
                if (node.getIsReal()) {
                    this.result++;
                }
            };
            visitor.shouldVisit = function(key, node) {
                return true;
            };
            visitor.shouldRecurse = function(key, node){
                return true;
            };
            visitor.shouldVisitChild = function(key, childNode) {
                return true;
            };

            this.visit("", visitor);
            return visitor.result;
        };

        this.getNumberOfNodes = function() {
            var visitor = new Visitor();
            visitor.result = 0;

            visitor.visit = function(key, parent, node) {
                this.result++;
            };
            visitor.shouldVisit = function(key, node) {
                return true;
            };
            visitor.shouldRecurse = function(key, node){
                return true;
            };
            visitor.shouldVisitChild = function(key, childNode) {
                return true;
            };

            this.visit("", visitor);
            return visitor.result;
        };
    }

    String.prototype.startsWith = function(str) {
        return this.indexOf(str) === 0;
    };

    Array.prototype.contains = function (element) {
        return self.indexOf(element) !== -1;
    };

    function RadixTreeNode(key, isRoot) {
        this.children = [];
        this.key = key;
        this.isReal;
        this.value;

        this.deepCopy = function() {
            var result = new RadixTreeNode();
            result.setKey(this.getKey());
            result.children = this.getChildren();
            result.setReal(this.getIsReal());
            result.setValue(this.getValue());
            return result;
        };

        this.setReal = function(isReal) {
            this.isReal = isReal;
        };

        this.getIsReal = function() {
            return this.isReal;
        };

        this.getValue = function() {
            return this.value;
        };

        this.setValue = function(value) {
            this.value = value;
        };

        this.addChild = function(node) {
            this.children.push(node);
        };

        this.getKey = function() {
            return this.key;
        };

        this.setKey = function(key) {
            this.key = key;
        };

        this.isRoot = function() {
            return this.key === "";
        };

        this.getChildren = function() {
            return this.children;
        };

        this.clearChildren = function() {
            this.children = [];
        };

        this.getNumberOfMatchingCharacters = function(key) {
            var result = 0;
            while (result < key.length && result < this.key.length) {
                if (key.charAt(result) != this.key.charAt(result)) {
                    break;
                }
                result++;
            }
            return result;
        };

        this.isStringSubNode = function(someString) {
            if (this.isRoot()) {
                return true;
            } else {
                return (this.getNumberOfMatchingCharacters(someString) < someString.length) &&
                       (this.getNumberOfMatchingCharacters(someString) >= this.key.length);
            }
        };

        this.isStringPartialMatch = function(someString) {
            return this.getNumberOfMatchingCharacters(someString) > 0 &&
                   this.getNumberOfMatchingCharacters(someString) < this.key.length;
        };

        this.getMatchingPortionOfString = function(someString) {
            return someString.substring(this.getNumberOfMatchingCharacters(someString));
        };

        this.getMatchingPortionOfNodeKey = function(someString) {
            return this.key.substring(this.getNumberOfMatchingCharacters(someString));
        };

        this.getUnmatchingPortionOfString = function(someString) {
            return someString.substring(0, this.getNumberOfMatchingCharacters(someString));
        };
    }

    function Visitor() {
        var result;
        this.getResult = function() {
            return this.result;
        };
        this.shouldBreakAfterFindingChild = function() {
            return false;
        };
    }

    window['RadixTree'] = RadixTree;
})();
