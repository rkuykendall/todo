import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './Honmoon.module.css';

/*
  Honmoon (Lines Only) – Robust Shader Version
  ---------------------------------------------------------------------
  A self-contained golden shimmer overlay that activates when visible.
  
  Fixes: Handles environments where GLSL derivatives (fwidth/dFdx/dFdy)
  are unavailable in WebGL1 by compiling a fallback shader without them.

  • If OES_standard_derivatives is present -> crisp AA lines using fwidth
  • Else -> manual line thickness approximation using resolution

  Internal constants (previously props):
    - speed: overall animation speed
    - lineDensity: number of shimmering contour lines
    - shimmer: intensity of highlight pulse
    - rippleAmp: amplitude of radial ripples
    - noiseAmp: amount of flowing distortion

  NOTE: The canvas is transparent—only yellow lines are drawn.
*/

// Shimmer configuration constants
const SPEED = 0.12;
const LINE_DENSITY = 25;
const SHIMMER = 0.8;
const RIPPLE_AMP = 0.4;
const NOISE_AMP = 0.3;

// Vertex shader (full‑screen triangle)
const VERTEX_SHADER = `
  attribute vec2 position;
  void main(){
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

// Common GLSL chunks used by both fragment variants
const FRAGMENT_COMMON = `
  precision highp float;
  uniform vec2  u_res;       // canvas size (px)
  uniform float u_time;      // seconds
  // x: lineDensity, y: shimmer, z: rippleAmp, w: noiseAmp
  uniform vec4  u_params;

  vec2 toUV(vec2 frag){
    float aspect = u_res.x / u_res.y;
    vec2 uv = frag / u_res;
    uv -= 0.5; uv.x *= aspect; // center and keep circles round
    return uv;
  }

  float hash(vec2 p){
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5,183.3)));
    return fract(sin(p.x+p.y)*43758.5453123);
  }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    float n = mix(
      mix(hash(i+vec2(0,0)), hash(i+vec2(1,0)), u.x),
      mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
    return n*2.0-1.0;
  }
  float fbm(vec2 p){
    float a=0.5, s=0.0; vec2 shift=vec2(100.0);
    for(int i=0;i<4;i++){ s += a*noise(p); p = p*2.02 + shift; a*=0.5; }
    return s;
  }

  struct RenderOut { vec3 color; float alpha; };

  RenderOut render(){
    vec2 uv = toUV(gl_FragCoord.xy);

    // Parameters
    float lineDensity = u_params.x;  // more = tighter lines
    float shimmer     = u_params.y;  // subtle brightness wobble
    float rippleAmp   = u_params.z;  // radial ripple amplitude
    float noiseAmp    = u_params.w;  // flow distortion amount

    // Focal origin slightly off-center
    vec2 focus = vec2(0.10, -0.02);
    float r = length(uv - focus);

    // Slower time for calmer ripples
    float t = u_time * 0.6;

    // Gentle flow distortion
    vec2 flow = vec2(
      fbm(uv*1.8 + t*0.08),
      fbm(uv*1.6 - t*0.07)
    );
    uv += flow * 0.05 * noiseAmp;

    // Smoother, wider-spaced radial ripples
    float rip = sin( (r*5.0 - t*1.8) ) * rippleAmp; // lower freq & speed

    // Warped axis for lines
    float bands = uv.y*1.4 + rip + fbm(uv*2.2 + t*0.12)*0.25;

    // Return intermediates via globals (packed later per-variant)
    vec3 baseColor = vec3(1.0, 0.85, 0.22);
    float pulse = 0.15 * sin(t*2.0) * shimmer; // gentle shimmer
    vec3 col = baseColor * (0.9 + pulse);

    // arg is the periodic function for stripes
    float arg = bands * lineDensity;

    // placeholder alpha; variant decides AA method
    return RenderOut(col, arg);
  }
`;

// Fragment shader with derivatives (best AA)
const FRAGMENT_WITH_DERIV = `
  #extension GL_OES_standard_derivatives : enable
  ${FRAGMENT_COMMON}
  void main(){
    RenderOut ro = render();
    float s = sin(ro.alpha);
    float w = fwidth(ro.alpha) * 0.9; // crisp, resolution‑aware
    float stripe = 1.0 - smoothstep(0.0, w, abs(s));
    gl_FragColor = vec4(ro.color, stripe);
  }
`;

// Fallback fragment shader without derivatives
const FRAGMENT_NO_DERIV = `
  ${FRAGMENT_COMMON}
  void main(){
    RenderOut ro = render();
    float s = sin(ro.alpha);
    // Approximate thickness based on resolution (safe fallback)
    float approxW = (1.5 / u_res.y); // thinner on high‑DPI
    float stripe = 1.0 - smoothstep(0.0, approxW, abs(s));
    gl_FragColor = vec4(ro.color, stripe);
  }
`;

export default function Honmoon({ visible }: { visible: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const startRef = useRef<number>(performance.now());
  const uTimeRef = useRef<WebGLUniformLocation | null>(null);
  const uResRef = useRef<WebGLUniformLocation | null>(null);
  const uParamsRef = useRef<WebGLUniformLocation | null>(null);

  useEffect(() => {
    if (!visible) return;

    // Small delay to ensure the canvas is fully rendered after animation starts
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const gl = canvas.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: false,
        antialias: false,
        preserveDrawingBuffer: false,
      }) as WebGLRenderingContext | null;

      if (!gl) {
        console.warn('WebGL not supported, falling back to placeholder');
        return;
      }

      let cleanedUp = false;
      const hasDeriv = !!gl.getExtension('OES_standard_derivatives');

      // Create program
      function compile(type: number, src: string): WebGLShader | null {
        if (!gl || cleanedUp) return null;
        const shader = gl.createShader(type);
        if (!shader) return null;

        gl.shaderSource(shader, src);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          console.error('Shader compile error:', gl.getShaderInfoLog(shader));
          gl.deleteShader(shader);
          return null;
        }
        return shader;
      }

      const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
      const fs = compile(
        gl.FRAGMENT_SHADER,
        hasDeriv ? FRAGMENT_WITH_DERIV : FRAGMENT_NO_DERIV
      );

      if (!vs || !fs) {
        if (vs) gl.deleteShader(vs);
        if (fs) gl.deleteShader(fs);
        return;
      }

      const program = gl.createProgram();
      if (!program) {
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        return;
      }

      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);

      // Clean up shaders after linking
      gl.deleteShader(vs);
      gl.deleteShader(fs);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return;
      }

      gl.useProgram(program);
      programRef.current = program;

      // Fullscreen triangle
      const buffer = gl.createBuffer();
      if (!buffer) {
        gl.deleteProgram(program);
        return;
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      const vertices = new Float32Array([-1, -1, 3, -1, -1, 3]);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

      const positionLocation = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      // Uniforms
      uTimeRef.current = gl.getUniformLocation(program, 'u_time');
      uResRef.current = gl.getUniformLocation(program, 'u_res');
      uParamsRef.current = gl.getUniformLocation(program, 'u_params');

      const onResize = () => {
        if (!gl || cleanedUp) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = canvas.getBoundingClientRect();
        const w = Math.max(1, Math.floor(rect.width * dpr));
        const h = Math.max(1, Math.floor(rect.height * dpr));

        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }

        gl.viewport(0, 0, w, h);
        if (uResRef.current) {
          gl.uniform2f(uResRef.current, w, h);
        }
      };

      const tick = () => {
        if (!gl || cleanedUp) return;

        try {
          const t = ((performance.now() - startRef.current) / 1000) * SPEED;

          if (uTimeRef.current) {
            gl.uniform1f(uTimeRef.current, t);
          }
          if (uParamsRef.current) {
            gl.uniform4f(
              uParamsRef.current,
              LINE_DENSITY,
              SHIMMER,
              RIPPLE_AMP,
              NOISE_AMP
            );
          }

          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.drawArrays(gl.TRIANGLES, 0, 3);

          rafRef.current = requestAnimationFrame(tick);
        } catch (error) {
          console.warn('WebGL rendering error:', error);
        }
      };

      let resizeObserver: ResizeObserver | null = null;
      try {
        resizeObserver = new ResizeObserver(onResize);
        resizeObserver.observe(canvas);
        onResize();
        tick();
      } catch (error) {
        console.error('Setup error:', error);
      }

      return () => {
        cleanedUp = true;

        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }

        if (resizeObserver) {
          resizeObserver.disconnect();
        }

        if (gl && program) {
          gl.deleteProgram(program);
        }
        if (gl && buffer) {
          gl.deleteBuffer(buffer);
        }

        // Don't manually lose context - let browser handle it naturally
      };
    }, 100); // 100ms delay

    return () => {
      clearTimeout(timer);
    };
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: 1.2,
            ease: 'easeInOut',
          }}
        >
          <div className={styles.container}>
            <canvas ref={canvasRef} className={styles.canvas} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
