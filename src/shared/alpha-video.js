// Transparent video that works in every browser.
// The source file carries the picture on its left half and the matte on its right half;
// a tiny WebGL shader recombines them on a canvas each frame.

const VERT = `
attribute vec2 p;
varying vec2 uv;
void main() {
  uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
uniform sampler2D t;
varying vec2 uv;
void main() {
  vec3 c = texture2D(t, vec2(uv.x * 0.5, uv.y)).rgb;
  float a = texture2D(t, vec2(0.5 + uv.x * 0.5, uv.y)).r;
  a = smoothstep(0.06, 0.94, a);
  gl_FragColor = vec4(c * a, a);
}`;

/**
 * @param {HTMLCanvasElement} canvas  where the cut-out is drawn
 * @param {HTMLVideoElement} video    hidden, muted, looping stacked source
 * @returns {boolean} false when WebGL is unavailable (caller keeps the still image)
 */
export function alphaVideo(canvas, video) {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) return false;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
  gl.useProgram(prog);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  let sized = false;
  let drew = false;

  const draw = () => {
    if (video.readyState < 2) return;
    if (!sized) {
      canvas.width = video.videoWidth / 2;
      canvas.height = video.videoHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
      sized = true;
    }
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
    } catch {
      return;
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (!drew) {
      drew = true;
      canvas.dispatchEvent(new Event('firstframe'));
    }
  };

  if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
    const step = () => {
      draw();
      video.requestVideoFrameCallback(step);
    };
    video.requestVideoFrameCallback(step);
  } else {
    const step = () => {
      if (!video.paused) draw();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  video.addEventListener('loadeddata', draw);
  video.addEventListener('seeked', draw);
  draw();
  return true;
}
