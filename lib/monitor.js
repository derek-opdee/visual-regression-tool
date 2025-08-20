const EventEmitter = require('events');

class Monitor extends EventEmitter {
  constructor(vrt, options) {
    super();
    this.vrt = vrt;
    this.options = {
      url: options.url,
      interval: options.interval || 300, // 5 minutes default
      threshold: options.threshold || 0.1,
      onDifference: options.onDifference || (() => {}),
      pages: options.pages || ['/']
    };
    this.baseline = null;
    this.intervalId = null;
    this.isRunning = false;
    this.checkCount = 0;
  }

  async start() {
    if (this.isRunning) {
      throw new Error('Monitor is already running');
    }

    this.isRunning = true;
    this.emit('start');

    // Initial check
    await this.check();

    // Set up interval
    this.intervalId = setInterval(() => {
      this.check().catch(error => {
        this.emit('error', error);
      });
    }, this.options.interval * 1000);
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    this.emit('stop');
  }

  async check() {
    this.checkCount++;
    this.emit('check:start', this.checkCount);

    try {
      const current = await this.vrt.capture(this.options.url, {
        outputDir: `monitoring/check-${Date.now()}`
      });

      if (!this.baseline) {
        this.baseline = current;
        this.emit('baseline:set', current);
      } else {
        const results = await this.vrt.compare(
          this.baseline[0].path.replace(/[^\/]+\.png$/, ''),
          current[0].path.replace(/[^\/]+\.png$/, ''),
          { threshold: this.options.threshold }
        );

        if (!results.passed) {
          this.emit('difference', results);
          this.options.onDifference(results);
        } else {
          this.emit('no-change');
        }
      }

      this.emit('check:complete', this.checkCount);
    } catch (error) {
      this.emit('check:error', error);
      throw error;
    }
  }

  updateBaseline(newBaseline) {
    this.baseline = newBaseline;
    this.emit('baseline:updated', newBaseline);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      checkCount: this.checkCount,
      url: this.options.url,
      interval: this.options.interval,
      threshold: this.options.threshold
    };
  }
}

module.exports = Monitor;