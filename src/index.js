import { get } from 'lodash';
import template from '@babel/template';

/**
 * ============================================================================
 * Utility Functions
 * ============================================================================
 */

/**
 * Check if the program is an entry program.
 * An entry program contains AppRegistry.registerComponent() which should be run at app start.
 */
const isEntryProgram = (statementPath) => {
  const expressionType = get(statementPath, ['node', 'expression', 'type']);
  if (expressionType !== 'CallExpression') return false;

  const callee = get(statementPath, ['node', 'expression', 'callee']);
  return (
    callee.type === 'MemberExpression' &&
    callee.object.name === 'AppRegistry' &&
    callee.property.name === 'registerComponent'
  );
};

/**
 * Check if the event should be tracked based on naming conventions.
 */
const shouldTrackEvent = (str) => 
  /\bon[a-zA-Z]*([Pp]ress|[Cc]lick|[Cc]hange|[Cc]hangeText|[Ss]elect|[Cc]ancel|[Ss]ubmit)\b/.test(str);

/**
 * ============================================================================
 * Code Generation
 * ============================================================================
 */

/**
 * Generate the entry code snippet for initializing global logging.
 */
const generateEntryCode = template.smart(`
import matrixLog from 'babel-plugin-matrix/matrixLog';
import { onBeforeAppStart, onBeforeMessageSend, endPointUrl } from './matrixConfig';
global.matrixLog = matrixLog;
global.matrixLog?.setEndPointUrl(endPointUrl);
global.matrixLog?.setOnBeforeAppStart(onBeforeAppStart);
global.matrixLog?.setOnBeforeMessageSend(onBeforeMessageSend);
global.matrixLog?.appendLog('Matrixlog starts recording.');
`);

/**
 * Generate a logging statement with the provided parameters.
 */
const generateLogStatement = (params) => 
  template.smart(`global.matrixLog.appendLog(${JSON.stringify(params)});`)();

/**
 * ============================================================================
 * AST Manipulation
 * ============================================================================
 */

/**
 * Add component lifecycle methods (if missing) and append logging statements.
 */
const addLifecycleMethodsWithLogging = (methodName, classPath, fullFileName, types) => {
  const params = { fullFileName, elementType: 'function', nodeName: methodName };
  const logStatement = generateLogStatement(params);

  const method = types.classMethod(
    'method',
    types.identifier(methodName),
    [],
    types.blockStatement([logStatement])
  );
  classPath.get('body').unshiftContainer('body', method);
};

/**
 * Append a logging statement to the specified class method.
 */
const appendLogToMethod = (methodName, methodPath, fullFileName) => {
  const params = { fullFileName, elementType: 'function', nodeName: methodName };
  const logStatement = generateLogStatement(params);
  methodPath.get('body').pushContainer('body', logStatement);
};

/**
 * Traverse class declarations and append logging to lifecycle methods.
 */
const traverseClassDeclaration = (classPath, fullFileName, types) => {
  const superClassName = get(classPath, ['node', 'superClass', 'name']) || get(classPath, ['node', 'superClass', 'property', 'name']);
  if (!['Component', 'PureComponent'].includes(superClassName)) return;

  let hasComponentDidMount = false;
  let hasComponentWillUnmount = false;

  classPath.traverse({
    ClassMethod(methodPath) {
      const methodName = get(methodPath, ['node', 'key', 'name']);
      if (methodName === 'componentDidMount') {
        hasComponentDidMount = true;
        appendLogToMethod(methodName, methodPath, fullFileName);
      }
      if (methodName === 'componentWillUnmount') {
        hasComponentWillUnmount = true;
        appendLogToMethod(methodName, methodPath, fullFileName);
      }
    },
  });

  if (!hasComponentDidMount) {
    addLifecycleMethodsWithLogging('componentDidMount', classPath, fullFileName, types);
  }
  if (!hasComponentWillUnmount) {
    addLifecycleMethodsWithLogging('componentWillUnmount', classPath, fullFileName, types);
  }
};

/**
 * Traverse and modify JSX expression containers to wrap callbacks with logging.
 */
const traverseJSXExpressionContainer = (jsxExPath, params, types) => {
  if (jsxExPath.node.isClean) return;

  const callbackWrapper = template.expression(`
    (...params) => {
      const originalCallback = ORIGINAL_SOURCE;
      matrixLog?.appendLog(${JSON.stringify(params)});
      originalCallback?.(...params);
    }
  `)({ ORIGINAL_SOURCE: jsxExPath.node.expression });

  jsxExPath.replaceWith(types.jsxExpressionContainer(callbackWrapper));
  jsxExPath.node.isClean = true;
};

/**
 * Traverse JSX elements to identify and modify attributes that require logging.
 */
const traverseJSXElement = (elementPath, fullFileName, types) => {
  let shouldLog = false;

  elementPath.traverse({
    JSXAttribute(attPath) {
      const attributeName = get(attPath, ['node', 'name', 'name']);
      if (shouldTrackEvent(attributeName)) {
        attPath.node.shouldAppendLog = true;
        shouldLog = true;
      }
    },
  });

  if (!shouldLog) return;

  const elementType = get(elementPath, ['node', 'openingElement', 'name', 'name'], '');
  let textContent = '';
  
  elementPath.traverse({
    JSXText(textPath) {
      textContent += get(textPath, ['node', 'value'], '');
    },
  });

  elementPath.traverse({
    JSXAttribute(attPath) {
      if (!attPath.node.shouldAppendLog || attPath.node.isClean) return;

      const nodeName = get(attPath, ['node', 'name', 'name']);
      const params = { fullFileName, elementType, nodeName, text: textContent.trim() };
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
 * Export Plugin
 * ============================================================================
 */

module.exports = function(babel) {
  const types = babel.types;
  let entryCodeInserted = false;

  return {
    visitor: {
      Program(path) {
        const fullFileName = get(path, ['hub', 'file', 'opts', 'filename'], '');

        path.traverse({
          ClassExpression(classPath) {
            traverseClassDeclaration(classPath, fullFileName, types);
          },
          JSXElement(elementPath) {
            traverseJSXElement(elementPath, fullFileName, types);
          },
        });

        if (entryCodeInserted) return;

        path.traverse({
          ExpressionStatement(statementPath) {
            if (isEntryProgram(statementPath)) {
              const entryCode = generateEntryCode();
              path.unshiftContainer('body', entryCode);
              entryCodeInserted = true;
            }
          },
        });
      },
    },
  };
};
