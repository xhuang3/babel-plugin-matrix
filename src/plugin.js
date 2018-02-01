const template = require('@babel/template');
const get = require('lodash/get');

// todo
const routeNames = [
  'LeftSideMenuContainer',
  'HomeContainer',
  // =====
  'InitializeScreen',
  'Test',
  'UserProtocol',
  'RefundSuccessContainer',
  'ConsumeRecordContainer',
  'SwiperContainer',
  'LoginInputTel',
  'LoginCheckVCode',
  'Certification',
  'UserInfoContainer',
  'Deposit',
  'DrawerContainer',
  'ScanQRCodeScreen',
  'POISearchScreen',
  'ManualInputScreen',
  'WebViewPageScreen',
  'WebViewScan',
  'WalletContainer',
  'TopUpContainer',
  'TopUpProtocolContainer',
  'TripDetailContainer',
  'EventTrackerContainer',
];

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
const isEntryProgram = function(statementPath) {
  if (get(statementPath, ['node', 'expression', 'type']) !== 'CallExpression') {
    return false;
  }

  const callee = get(statementPath, ['node', 'expression', 'callee']);
  if (
    callee.type === 'MemberExpression' &&
    callee.object.name === 'AppRegistry' &&
    callee.property.name === 'registerComponent'
  ) {
    return true;
  }
};

/**
 * Check if this event should be track
 */
const checkShouldAppend = function(str) {
  return str.match(
    /on.*(press|Press|click|Click|change|Change|changeText|ChangeText|select|Select|cancel|Cancel|submit|Submit)/
  );
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
const buildEntryCode = template.smart(`
import matrixLog from 'matrix-log';
import { onBeforeAppStart, onBeforeMessageSend, endPointUrl } from './matrixConfig';
global.matrixLog = matrixLog;
global.matrixLog && global.matrixLog.setEndPointUrl(endPointUrl)
global.matrixLog && global.matrixLog.setOnBeforeAppStart(onBeforeAppStart);
global.matrixLog && global.matrixLog.setOnBeforeMessageSend(onBeforeMessageSend);
global.matrixLog && global.matrixLog.appendLog('Matrixlog starts recording.');
`);

/**
 *
 * @param {*} logString
 * @param {*} t
 */
const buildLogger = function(param, t) {
  const jsonParam = JSON.stringify(param);
  return template.smart(`global.matrixLog.appendLog(${jsonParam});`)();
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
const addDidMountOrWillUnmountToClassWithLog = function(
  methodName,
  path,
  t,
  fullFileName
) {
  const body = [];
  const param = {
    fullFileName,
    elementType: 'function',
    nodeName: methodName,
  };
  body.push(buildLogger(param, t));
  const ast = t.ClassMethod(
    'method',
    t.Identifier(methodName),
    [],
    t.BlockStatement(body)
  );
  path.get('body').unshiftContainer('body', ast);
};

/**
 *
 * @param {*} methodPath
 * @param {*} t
 */
const appendLogToClassMethod = function(
  methodName,
  methodPath,
  t,
  fullFileName
) {
  const param = {
    fullFileName,
    elementType: 'function',
    nodeName: methodName,
  };
  const ast = buildLogger(param, t);
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
const traverseClassDeclaration = function(classPath, t, fullFileName) {
  const superClassName =
    get(classPath, ['node', 'superClass', 'name']) ||
    get(classPath, ['node', 'superClass', 'property', 'name']);
  if (superClassName !== 'Component' && superClassName !== 'PureComponent') {
    return;
  }

  if (routeNames.indexOf(get(classPath, ['node', 'id', 'name'])) === -1) return;

  let hasComponentDidMount = false;
  let hasComponentWillUnmount = false;

  classPath.traverse({
    // Traverse class methods to find
    ClassMethod: function ClassMethod(methodPath) {
      const methodName = get(methodPath, ['node', 'key', 'name']);
      let isDidMountOrWillUnmount = false;
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
    },
  });

  // If this class does not implement componentDidMount/componentWillUnmount
  // Insert these methods
  if (!hasComponentDidMount) {
    const methodName = 'componentDidMount';
    addDidMountOrWillUnmountToClassWithLog(
      methodName,
      classPath,
      t,
      fullFileName
    );
  }

  if (!hasComponentWillUnmount) {
    const methodName = 'componentWillUnmount';
    addDidMountOrWillUnmountToClassWithLog(
      methodName,
      classPath,
      t,
      fullFileName
    );
  }
};

/**
 *
 * @param {*} jsxExPath
 * @param {*} t
 */
const traverseJSXExpressionContainer = function(jsxExPath, t, param) {
  if (jsxExPath.node.isClean) return;
  const jsonParam = JSON.stringify(param);
  const ast = template.expression(`
    (...params) => {
      const callbackWrapper=ORIGINAL_SOURCE;
      matrixLog && matrixLog.appendLog(${jsonParam});
      callbackWrapper && callbackWrapper(...params);
    }
    `)({
    ORIGINAL_SOURCE: jsxExPath.node.expression,
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
const traverseJSXElement = function(elementPath, t, fullFileName) {
  let needAppend = false;
  elementPath.traverse({
    JSXAttribute(attPath) {
      if (attPath.node.shouldAppendLog) return;

      const nodeName = get(attPath, ['node', 'name', 'name']);
      if (checkShouldAppend(nodeName)) {
        // if (attributesNeedCheck.indexOf(nodeName) !== -1) {
        attPath.node.shouldAppendLog = true;
        needAppend = true;
      }
    },
  });

  if (!needAppend) return;
  const elementType = get(
    elementPath,
    ['node', 'openingElement', 'name', 'name'],
    ''
  );

  let text = '';
  elementPath.traverse({
    JSXText(textPath) {
      text += get(textPath, ['node', 'value'], '');
    },
  });

  elementPath.traverse({
    JSXAttribute(attPath) {
      if (!attPath.node.shouldAppendLog) return;
      if (attPath.node.isClean) return;

      const nodeName = get(attPath, ['node', 'name', 'name']);

      text = text.replace(/(\n|\r|\s)/g, '');
      const param = {
        fullFileName,
        elementType,
        nodeName,
        text,
      };
      attPath.traverse({
        JSXExpressionContainer(jsxExPath) {
          traverseJSXExpressionContainer(jsxExPath, t, param);
        },
      });
      attPath.node.isClean = true;
    },
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
module.exports = function(babel) {
  const t = babel.types;
  let insertEntryCode = false;

  return {
    visitor: {
      // Traverse all programs and find the one that register component
      // Must register component in this form: AppRegistry.registerComponent()
      Program(path) {
        // Workaround
        const fullFileName = get(path, ['hub', 'file', 'opts', 'filename'], '');

        path.traverse({
          ClassExpression(classPath) {
            traverseClassDeclaration(classPath, t, fullFileName);
          },

          // Then traverse all jsx attributes
          // Wrap onPress
          JSXElement(elementPath) {
            traverseJSXElement(elementPath, t, fullFileName);
          },
        });

        // If entry has been inserted, no need to visit more programs
        if (insertEntryCode) return;

        // Traverse the program to see if this is a entry program
        // entry program means the program that registers component
        let entryProgram = false;
        path.traverse({
          ExpressionStatement(statementPath) {
            if (entryProgram) return;
            entryProgram = isEntryProgram(statementPath);
          },
        });

        if (entryProgram && !insertEntryCode) {
          const ast = buildEntryCode();
          path.unshiftContainer('body', ast);
          insertEntryCode = true;
        }
      },
    },
  };
};
