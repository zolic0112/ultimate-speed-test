// Extracted Renderer class for the lightspeed fragment shader.
// Owned by app/script.js — no DOM coupling here.
class ShaderRenderer {
  #vertexSrc = "#version 300 es\nprecision highp float;\nin vec4 position;\nvoid main(){gl_Position=position;}";
  #fragmtSrc = "#version 300 es\nprecision highp float;\nout vec4 O;\nuniform float time;\nuniform vec2 resolution;\nvoid main(){vec2 uv=gl_FragCoord.xy/resolution;O=vec4(uv,0.0,1.0);}";
  #vertices = [-1, 1, -1, -1, 1, 1, 1, -1];

  constructor(canvas, scale) {
    this.canvas = canvas;
    this.scale = scale;
    this.gl = canvas.getContext('webgl2');
    this.gl.viewport(0, 0, canvas.width * scale, canvas.height * scale);
    this.shaderSource = this.#fragmtSrc;
    this.mouseCoords = [0, 0];
    this.pointerCoords = [0, 0];
    this.nbrOfPointers = 0;
    this.extraProvider = null;
    this.contextLost = false;

    // WebGL context can be lost when iOS Safari moves the app to the
    // background under memory pressure. Without this handler the shader
    // simply stops rendering forever and you get a black screen on return.
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();  // signal to the browser that we want to restore
      this.contextLost = true;
      console.warn('[shader] WebGL context lost');
    }, false);
    canvas.addEventListener('webglcontextrestored', () => {
      console.log('[shader] WebGL context restored');
      this.contextLost = false;
      // Rebuild program + buffers from scratch using last-known shader.
      this.setup();
      this.init();
    }, false);
  }

  setExtraUniformProvider(fn) { this.extraProvider = fn; }
  updateMouse(c) { this.mouseCoords = c; }
  updatePointerCoords(c) { this.pointerCoords = c; }
  updatePointerCount(n) { this.nbrOfPointers = n; }
  updateScale(scale) {
    this.scale = scale;
    this.gl.viewport(0, 0, this.canvas.width * scale, this.canvas.height * scale);
  }
  // When the canvas is larger than the visible viewport (e.g. bled past iOS
  // home indicator), tell the shader to size its content to the VISIBLE area
  // instead. Otherwise the shader's `min(R.x, R.y)` normalization sees the
  // canvas as taller-than-wide and renders the tunnel stretched vertically.
  setLogicalResolution(w, h) {
    this.logicalW = w;
    this.logicalH = h;
  }

  updateShader(source) {
    this.reset();
    this.shaderSource = source;
    this.setup();
    this.init();
  }

  compile(shader, source) {
    const gl = this.gl;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
    }
  }

  test(source) {
    let result = null;
    const gl = this.gl;
    const shader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) result = gl.getShaderInfoLog(shader);
    if (gl.getShaderParameter(shader, gl.DELETE_STATUS)) gl.deleteShader(shader);
    return result;
  }

  reset() {
    const { gl, program, vs, fs } = this;
    if (!program || gl.getProgramParameter(program, gl.DELETE_STATUS)) return;
    if (gl.getShaderParameter(vs, gl.DELETE_STATUS)) { gl.detachShader(program, vs); gl.deleteShader(vs); }
    if (gl.getShaderParameter(fs, gl.DELETE_STATUS)) { gl.detachShader(program, fs); gl.deleteShader(fs); }
    gl.deleteProgram(program);
  }

  setup() {
    const gl = this.gl;
    this.vs = gl.createShader(gl.VERTEX_SHADER);
    this.fs = gl.createShader(gl.FRAGMENT_SHADER);
    this.compile(this.vs, this.#vertexSrc);
    this.compile(this.fs, this.shaderSource);
    this.program = gl.createProgram();
    gl.attachShader(this.program, this.vs);
    gl.attachShader(this.program, this.fs);
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(this.program));
  }

  init() {
    const { gl, program } = this;
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.#vertices), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    program.resolution = gl.getUniformLocation(program, 'resolution');
    program.time = gl.getUniformLocation(program, 'time');
    program.touch = gl.getUniformLocation(program, 'touch');
    program.pointerCount = gl.getUniformLocation(program, 'pointerCount');
    program.speed = gl.getUniformLocation(program, 'speed');
    program.phase = gl.getUniformLocation(program, 'phase');
    program.burst = gl.getUniformLocation(program, 'burst');
  }

  render(now = 0) {
    const { gl, program, buffer, canvas } = this;
    if (this.contextLost) return;  // skip frames while context is restoring
    if (!program || gl.getProgramParameter(program, gl.DELETE_STATUS)) return;
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    // Use logical (viewport-sized) resolution if set, otherwise fall back to
    // the physical canvas size. Logical resolution makes the tunnel render
    // proportionally to viewport even when canvas extends past it for bleed.
    const rW = this.logicalW || canvas.width;
    const rH = this.logicalH || canvas.height;
    gl.uniform2f(program.resolution, rW, rH);
    gl.uniform1f(program.time, now * 1e-3);
    gl.uniform2f(program.touch, ...this.mouseCoords);
    gl.uniform1i(program.pointerCount, this.nbrOfPointers);
    const extra = this.extraProvider ? this.extraProvider() : { speed: 0, phase: 0, burst: 0 };
    gl.uniform1f(program.speed, extra.speed || 0);
    gl.uniform1f(program.phase, extra.phase || 0);
    gl.uniform1f(program.burst, extra.burst || 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

window.ShaderRenderer = ShaderRenderer;
