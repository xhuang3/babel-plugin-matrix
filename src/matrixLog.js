import { forEach } from 'lodash';

const LOG_LIMIT = 100;
const INTERVAL_SEC = 8;
const ENDPOINT = 'https://freegolog.ofo.com/report/v1';

class MatrixLog {
  constructor() {
    this.log = [];
    this.interval = undefined;
    this.instance = undefined;
    this.body = [];
    this.trackedRouteNames = [];

    this.onBeforeAppStart = async () => {};
    this.onBeforeMessageSend = async () => {};
    this._setInterval();
  }

  _setInterval() {
    this.interval = setInterval(() => {
      this._sendLog();
    }, INTERVAL_SEC * 1000);
  }

  _setOnBeforeMessageSend(onBeforeMessageSend) {
    if (!onBeforeMessageSend) return;
    this.onBeforeMessageSend = onBeforeMessageSend;
  }

  _setOnBeforeAppStart(onBeforeAppStart) {
    if (!onBeforeAppStart) return;
    this.onBeforeAppStart = onBeforeAppStart;
  }

  _setTrackedRouteNames(routeNames) {
    if (!routeNames) return;
    this.trackedRouteNames = routeNames;
  }

  _transformFileNameToEventId(fullFileName) {
    if (!fullFileName) return '';
    let tokens = fullFileName.replace('.js', '').split('/');
    if (tokens.length > 3) {
      tokens = tokens.slice(tokens.length - 3);
    }
    return tokens.join('_');
  }

  // todo
  _deduplication() {
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

  async _appendLog(logItem) {
    if (!logItem) return;

    const action = logItem.nodeName;
    const evid = this._transformFileNameToEventId(logItem.fullFileName);
    const other = {
      elementType: logItem.elementType,
      innerText: logItem.text,
    };
    const data = await this.onBeforeMessageSend(action, evid, other);
    const date = new Date().getTime();
    this.log.push({
      date,
      data,
    });
  }

  _getLog() {
    return this.log;
  }

  /**
   * ============================================================================
   * Async methods
   * ============================================================================
   */

  async _sendLog() {
    if (this.log.length === 0) return;

    const header = await this.onBeforeAppStart();
    const body = this.log.map(item => item.data);

    const result = await fetch(ENDPOINT, {
      method: 'POST',
      body: JSON.stringify({
        header,
        body,
      }),
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

  static appendLog(logItem) {
    const matrixLogInstance = MatrixLog.getInstance();
    matrixLogInstance._appendLog(logItem);
  }

  static setOnBeforeAppStart(onBeforeAppStart) {
    const matrixLogInstance = MatrixLog.getInstance();
    matrixLogInstance._setOnBeforeAppStart(onBeforeAppStart);
  }

  static setOnBeforeMessageSend(onBeforeMessageSend) {
    const matrixLogInstance = MatrixLog.getInstance();
    matrixLogInstance._setOnBeforeMessageSend(onBeforeMessageSend);
  }

  static setTrackedRouteNames(routeNames) {
    const matrixLogInstance = MatrixLog.getInstance();
    matrixLogInstance._setTrackedRouteNames(routeNames);
  }

  static getLog() {
    const matrixLogInstance = MatrixLog.getInstance();
    return matrixLogInstance._getLog();
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new MatrixLog();
    }
    return this.instance;
  }
}

export default MatrixLog;
