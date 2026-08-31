class LoopbackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.readOffset = 0;
    this.port.onmessage = (e) => this.queue.push(e.data);
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    const framesNeeded = output[0].length;

    for (let i = 0; i < framesNeeded; i++) {
      if (this.queue.length === 0) {
        output[0][i] = 0;
        output[1][i] = 0;
        continue;
      }

      const chunk = this.queue[0];
      output[0][i] = chunk[this.readOffset * 2];
      output[1][i] = chunk[this.readOffset * 2 + 1];
      this.readOffset++;

      if (this.readOffset * 2 >= chunk.length) {
        this.queue.shift();
        this.readOffset = 0;
      }
    }

    return true;
  }
}

registerProcessor("loopback-processor", LoopbackProcessor);
