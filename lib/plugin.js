'use strict';

var template = require('@babel/template');
var get = require('lodash/get');

// todo
var routeNames = ['LeftSideMenuContainer', 'HomeContainer',
// =====
'InitializeScreen', 'Test', 'UserProtocol', 'RefundSuccessContainer', 'ConsumeRecordContainer', 'SwiperContainer', 'LoginInputTel', 'LoginCheckVCode', 'Certification', 'UserInfoContainer', 'Deposit', 'DrawerContainer', 'ScanQRCodeScreen', 'POISearchScreen', 'ManualInputScreen', 'WebViewPageScreen', 'WebViewScan', 'WalletContainer', 'TopUpContainer', 'TopUpProtocolContainer', 'TripDetailContainer', 'EventTrackerContainer'];

/**
 * ============================================================================
 * Check condition
 * ============================================================================
 */

/**
 * Check if the program is an entry program
 * entry program is the one the contains AppRegistry.registerComponent()
 * which should be run at the beginning of app start
 */
var isEntryProgram = function isEntryProgram(statementPath) {
  if (get(statementPath, ['node', 'expression', 'type']) !== 'CallExpression') {
    return false;
  }

  var callee = get(statementPath, ['node', 'expression', 'callee']);
  if (callee.type === 'MemberExpression' && callee.object.name === 'AppRegistry' && callee.property.name === 'registerComponent') {
    return true;
  }
};

/**
 * Check if this event should be track
 */
var checkShouldAppend = function checkShouldAppend(str) {
  return str.match(/on.*(press|Press|click|Click|change|Change|changeText|ChangeText|select|Select|cancel|Cancel|submit|Submit)/);
};

/**
 * ============================================================================
 * Building Code
 * ============================================================================
 */

/**
 * Build code snippet
 * Should do three things:
 * 1) Init global log with request url, time interval, etc.
 * 2) Should invoke user defined callback
 */
var buildEntryCode = template.smart('\nimport { matrixLog } from \'babel-plugin-matrix\';\nimport { onBeforeAppStart, onBeforeMessageSend } from \'./matrixConfig\';\nglobal.matrixLog = matrixLog.default;\nglobal.matrixLog.setOnBeforeAppStart(onBeforeAppStart);\nglobal.matrixLog.setOnBeforeMessageSend(onBeforeMessageSend);\nglobal.matrixLog.appendLog(\'Matrixlog starts recording.\');\n');

/**
 *
 * @param {*} logString
 * @param {*} t
 */
var buildLogger = function buildLogger(param, t) {
  var jsonParam = JSON.stringify(param);
  return template.smart('global.matrixLog.appendLog(' + jsonParam + ');')();
};

/**
 * ============================================================================
 * Append code
 * ============================================================================
 */

/**
 *
 * @param {*} methodName
 * @param {*} path
 * @param {*} t
 */
var addDidMountOrWillUnmountToClassWithLog = function addDidMountOrWillUnmountToClassWithLog(methodName, path, t, fullFileName) {
  var body = [];
  var param = {
    fullFileName: fullFileName,
    elementType: 'function',
    nodeName: methodName
  };
  body.push(buildLogger(param, t));
  var ast = t.ClassMethod('method', t.Identifier(methodName), [], t.BlockStatement(body));
  path.get('body').unshiftContainer('body', ast);
};

/**
 *
 * @param {*} methodPath
 * @param {*} t
 */
var appendLogToClassMethod = function appendLogToClassMethod(methodName, methodPath, t, fullFileName) {
  var param = {
    fullFileName: fullFileName,
    elementType: 'function',
    nodeName: methodName
  };
  var ast = buildLogger(param, t);
  methodPath.get('body').pushContainer('body', ast);
};

/**
 * ============================================================================
 * Traverse Node
 * ============================================================================
 */

/**
 *
 * @param {*} classPath
 * @param {*} t
 */
var traverseClassDeclaration = function traverseClassDeclaration(classPath, t, fullFileName) {
  var superClassName = get(classPath, ['node', 'superClass', 'name']) || get(classPath, ['node', 'superClass', 'property', 'name']);
  if (superClassName !== 'Component' && superClassName !== 'PureComponent') {
    return;
  }

  if (routeNames.indexOf(get(classPath, ['node', 'id', 'name'])) === -1) return;

  var hasComponentDidMount = false;
  var hasComponentWillUnmount = false;

  classPath.traverse({
    // Traverse class methods to find
    ClassMethod: function ClassMethod(methodPath) {
      var methodName = get(methodPath, ['node', 'key', 'name']);
      var isDidMountOrWillUnmount = false;
      if (methodName === 'componentDidMount') {
        hasComponentDidMount = true;
        isDidMountOrWillUnmount = true;
      }
      if (methodName === 'componentWillUnmount') {
        hasComponentWillUnmount = true;
        isDidMountOrWillUnmount = true;
      }

      if (isDidMountOrWillUnmount) {
        appendLogToClassMethod(methodName, methodPath, t, fullFileName);
      }
    }
  });

  // If this class does not implement componentDidMount/componentWillUnmount
  // Insert these methods
  if (!hasComponentDidMount) {
    var methodName = 'componentDidMount';
    addDidMountOrWillUnmountToClassWithLog(methodName, classPath, t, fullFileName);
  }

  if (!hasComponentWillUnmount) {
    var _methodName = 'componentWillUnmount';
    addDidMountOrWillUnmountToClassWithLog(_methodName, classPath, t, fullFileName);
  }
};

/**
 *
 * @param {*} jsxExPath
 * @param {*} t
 */
var traverseJSXExpressionContainer = function traverseJSXExpressionContainer(jsxExPath, t, param) {
  if (jsxExPath.node.isClean) return;
  var jsonParam = JSON.stringify(param);
  var ast = template.expression('\n    (...params) => {\n      const callbackWrapper=ORIGINAL_SOURCE;\n      global.matrixLog.appendLog(' + jsonParam + ');\n      callbackWrapper && callbackWrapper(...params);\n    }\n    ')({
    ORIGINAL_SOURCE: jsxExPath.node.expression
  });

  jsxExPath.replaceWith(t.JSXExpressionContainer(ast));
  jsxExPath.node.isClean = true;
};

/**
 *
 * @param {*} elementPath
 * @param {*} t
 * @param {*} fullFileName
 */
var traverseJSXElement = function traverseJSXElement(elementPath, t, fullFileName) {
  var needAppend = false;
  elementPath.traverse({
    JSXAttribute: function JSXAttribute(attPath) {
      if (attPath.node.shouldAppendLog) return;

      var nodeName = get(attPath, ['node', 'name', 'name']);
      if (checkShouldAppend(nodeName)) {
        // if (attributesNeedCheck.indexOf(nodeName) !== -1) {
        attPath.node.shouldAppendLog = true;
        needAppend = true;
      }
    }
  });

  if (!needAppend) return;
  var elementType = get(elementPath, ['node', 'openingElement', 'name', 'name'], '');

  var text = '';
  elementPath.traverse({
    JSXText: function JSXText(textPath) {
      text += get(textPath, ['node', 'value'], '');
    }
  });

  elementPath.traverse({
    JSXAttribute: function JSXAttribute(attPath) {
      if (!attPath.node.shouldAppendLog) return;
      if (attPath.node.isClean) return;

      var nodeName = get(attPath, ['node', 'name', 'name']);

      text = text.replace(/(\n|\r|\s)/g, '');
      var param = {
        fullFileName: fullFileName,
        elementType: elementType,
        nodeName: nodeName,
        text: text
      };
      attPath.traverse({
        JSXExpressionContainer: function JSXExpressionContainer(jsxExPath) {
          traverseJSXExpressionContainer(jsxExPath, t, param);
        }
      });
      attPath.node.isClean = true;
    }
  });
};

/**
 * ============================================================================
 * Export plugin
 * ============================================================================
 */

/**
 * 1) check if entry program, if it is, add the code snippet
 */
module.exports = function (babel) {
  var t = babel.types;
  var insertEntryCode = false;
  return {
    visitor: {
      // Traverse all programs and find the one that register component
      // Must register component in this form: AppRegistry.registerComponent()
      Program: function Program(path) {
        // Workaround
        var fullFileName = get(path, ['hub', 'file', 'opts', 'filename'], '');

        path.traverse({
          ClassExpression: function ClassExpression(classPath) {
            traverseClassDeclaration(classPath, t, fullFileName);
          },


          // Then traverse all jsx attributes
          // Wrap onPress
          JSXElement: function JSXElement(elementPath) {
            traverseJSXElement(elementPath, t, fullFileName);
          }
        });

        // If entry has been inserted, no need to visit more programs
        if (insertEntryCode) return;

        // Traverse the program to see if this is a entry program
        // entry program means the program that registers component
        var entryProgram = false;
        path.traverse({
          ExpressionStatement: function ExpressionStatement(statementPath) {
            if (entryProgram) return;
            entryProgram = isEntryProgram(statementPath);
          }
        });

        if (entryProgram && !insertEntryCode) {
          var ast = buildEntryCode();
          path.unshiftContainer('body', ast);
          insertEntryCode = true;
        }
      }
    }
  };
};

/**
 * ============================================================================
 * Export matrix log
 * ============================================================================
 */

module.exports.matrixLog = require('./matrixLog');