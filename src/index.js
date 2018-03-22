import { get } from 'lodash';
import template from '@babel/template';

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
    /\bon[a-zA-Z]*([Pp]ress|[Cc]lick|[Cc]hange|[Cc]hangeText|[Ss]elect|[Cc]ancel|[Ss]ubmit)\b/
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
import matrixLog from 'babel-plugin-matrix/matrixLog';
import { onBeforeAppStart, onBeforeMessageSend, endPointUrl } from './matrixConfig';
global.matrixLog = matrixLog;
global.matrixLog && global.matrixLog.setEndPointUrl(endPointUrl);
global.matrixLog && global.matrixLog.setOnBeforeAppStart(onBeforeAppStart);
global.matrixLog && global.matrixLog.setOnBeforeMessageSend(onBeforeMessageSend);
global.matrixLog && global.matrixLog.appendLog('Matrixlog starts recording.');
`);

/**
 *
 * @param {*} logString
 * @param {*} t
 */
const buildLogger = function(params) {
  const jsonParams = JSON.stringify(params);
  return template.smart(`global.matrixLog.appendLog(${jsonParams});`)();
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
  fullFileName,
  types
) {
  const body = [];
  const params = {
    fullFileName,
    elementType: 'function',
    nodeName: methodName,
  };
  body.push(buildLogger(params));
  const ast = types.ClassMethod(
    'method',
    types.Identifier(methodName),
    [],
    types.BlockStatement(body)
  );
  path.get('body').unshiftContainer('body', ast);
};

/**
 *
 * @param {*} methodPath
 * @param {*} t
 */
const appendLogToClassMethod = function(methodName, methodPath, fullFileName) {
  const params = {
    fullFileName,
    elementType: 'function',
    nodeName: methodName,
  };
  const ast = buildLogger(params);
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
const traverseClassDeclaration = function(classPath, fullFileName, types) {
  const superClassName =
    get(classPath, ['node', 'superClass', 'name']) ||
    get(classPath, ['node', 'superClass', 'property', 'name']);
  if (superClassName !== 'Component' && superClassName !== 'PureComponent') {
    return;
  }

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
        appendLogToClassMethod(methodName, methodPath, fullFileName);
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
      fullFileName,
      types
    );
  }

  if (!hasComponentWillUnmount) {
    const methodName = 'componentWillUnmount';
    addDidMountOrWillUnmountToClassWithLog(
      methodName,
      classPath,
      fullFileName,
      types
    );
  }
};

/**
 *
 * @param {*} jsxExPath
 * @param {*} t
 */
const traverseJSXExpressionContainer = function(jsxExPath, params, types) {
  if (jsxExPath.node.isClean) return;
  const jsonParams = JSON.stringify(params);
  const ast = template.expression(`
    (...params) => {
      const callbackWrapper=ORIGINAL_SOURCE;
      matrixLog && matrixLog.appendLog(${jsonParams});
      callbackWrapper && callbackWrapper(...params);
    }
    `)({
    ORIGINAL_SOURCE: jsxExPath.node.expression,
  });

  jsxExPath.replaceWith(types.JSXExpressionContainer(ast));
  jsxExPath.node.isClean = true;
};

/**
 *
 * @param {*} elementPath
 * @param {*} t
 * @param {*} fullFileName
 */
const traverseJSXElement = function(elementPath, fullFileName, types) {
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
      const params = {
        fullFileName,
        elementType,
        nodeName,
        text,
      };
      attPath.traverse({
        JSXExpressionContainer(jsxExPath) {
          traverseJSXExpressionContainer(jsxExPath, params, types);
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
  let insertEntryCode = false;
  const types = babel.types;
  return {
    visitor: {
      // Traverse all programs and find the one that register component
      // Must register component in this form: AppRegistry.registerComponent()
      Program(path) {
        // Workaround
        const fullFileName = get(path, ['hub', 'file', 'opts', 'filename'], '');

        path.traverse({
          ClassExpression(classPath) {
            traverseClassDeclaration(classPath, fullFileName, types);
          },

          // Then traverse all jsx attributes
          // Wrap onPress
          JSXElement(elementPath) {
            traverseJSXElement(elementPath, fullFileName, types);
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
