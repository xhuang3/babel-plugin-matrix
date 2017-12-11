'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lodash = require('lodash');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var LOG_LIMIT = 100;
var INTERVAL_SEC = 8;
var ENDPOINT = 'https://freegolog.ofo.com/report/v1';

var MatrixLog = function () {
  function MatrixLog() {
    _classCallCheck(this, MatrixLog);

    this.log = [];
    this.interval = undefined;
    this.instance = undefined;
    this.body = [];
    this.trackedRouteNames = [];

    this.onBeforeAppStart = async function () {};
    this.onBeforeMessageSend = async function () {};
    this._setInterval();
  }

  _createClass(MatrixLog, [{
    key: '_setInterval',
    value: function _setInterval() {
      var _this = this;

      this.interval = setInterval(function () {
        _this._sendLog();
      }, INTERVAL_SEC * 1000);
    }
  }, {
    key: '_setOnBeforeMessageSend',
    value: function _setOnBeforeMessageSend(onBeforeMessageSend) {
      if (!onBeforeMessageSend) return;
      this.onBeforeMessageSend = onBeforeMessageSend;
    }
  }, {
    key: '_setOnBeforeAppStart',
    value: function _setOnBeforeAppStart(onBeforeAppStart) {
      if (!onBeforeAppStart) return;
      this.onBeforeAppStart = onBeforeAppStart;
    }
  }, {
    key: '_setTrackedRouteNames',
    value: function _setTrackedRouteNames(routeNames) {
      if (!routeNames) return;
      this.trackedRouteNames = routeNames;
    }
  }, {
    key: '_transformFileNameToEventId',
    value: function _transformFileNameToEventId(fullFileName) {
      if (!fullFileName) return '';
      var tokens = fullFileName.replace('.js', '').split('/');
      if (tokens.length > 3) {
        tokens = tokens.slice(tokens.length - 3);
      }
      return tokens.join('_');
    }

    // todo

  }, {
    key: '_deduplication',
    value: function _deduplication() {
      // if (this.log.length === 0) {
      //   return [];
      // }
      // const dates = [];
      // forEach(this.log, (item) => {
      //   const date = item.date;
      //   const data = item.data;
      //   dates.push(data.date);
      // });
      // return this.log;
    }
  }, {
    key: '_appendLog',
    value: async function _appendLog(logItem) {
      if (!logItem) return;

      var action = logItem.nodeName;
      var evid = this._transformFileNameToEventId(logItem.fullFileName);
      var other = {
        elementType: logItem.elementType,
        innerText: logItem.text
      };
      var data = await this.onBeforeMessageSend(action, evid, other);
      var date = new Date().getTime();
      this.log.push({
        date: date,
        data: data
      });
    }
  }, {
    key: '_getLog',
    value: function _getLog() {
      return this.log;
    }

    /**
     * ============================================================================
     * Async methods
     * ============================================================================
     */

  }, {
    key: '_sendLog',
    value: async function _sendLog() {
      if (this.log.length === 0) return;

      var header = await this.onBeforeAppStart();
      var body = this.log.map(function (item) {
        return item.data;
      });

      var result = await fetch(ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({
          header: header,
          body: body
        })
      });
      // console.warn('log', header, body, result);
      // clear the log after success
      this.log = [];
    }

    /**
     * ============================================================================
     * Static methods
     * ============================================================================
     */

  }], [{
    key: 'appendLog',
    value: function appendLog(logItem) {
      var matrixLogInstance = MatrixLog.getInstance();
      matrixLogInstance._appendLog(logItem);
    }
  }, {
    key: 'setOnBeforeAppStart',
    value: function setOnBeforeAppStart(onBeforeAppStart) {
      var matrixLogInstance = MatrixLog.getInstance();
      matrixLogInstance._setOnBeforeAppStart(onBeforeAppStart);
    }
  }, {
    key: 'setOnBeforeMessageSend',
    value: function setOnBeforeMessageSend(onBeforeMessageSend) {
      var matrixLogInstance = MatrixLog.getInstance();
      matrixLogInstance._setOnBeforeMessageSend(onBeforeMessageSend);
    }
  }, {
    key: 'setTrackedRouteNames',
    value: function setTrackedRouteNames(routeNames) {
      var matrixLogInstance = MatrixLog.getInstance();
      matrixLogInstance._setTrackedRouteNames(routeNames);
    }
  }, {
    key: 'getLog',
    value: function getLog() {
      var matrixLogInstance = MatrixLog.getInstance();
      return matrixLogInstance._getLog();
    }
  }, {
    key: 'getInstance',
    value: function getInstance() {
      if (!this.instance) {
        this.instance = new MatrixLog();
      }
      return this.instance;
    }
  }]);

  return MatrixLog;
}();

exports.default = MatrixLog;