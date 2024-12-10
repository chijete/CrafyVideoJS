class CrafyVideoJSWebGLImageManager {
  constructor(targetWidth, targetHeight) {
    this.targetWidth = targetWidth;
    this.targetHeight = targetHeight;
    this.initWebGL();
  }

  initWebGL() {
    // Crear canvas offscreen para WebGL
    this.canvas = new OffscreenCanvas(this.targetWidth, this.targetHeight);
    this.gl = this.canvas.getContext('webgl2');

    if (!this.gl) {
      throw new Error('WebGL2 no disponible');
    }

    // Shaders para el redimensionamiento
    const vertexShaderSource = `#version 300 es
      in vec4 a_position;
      in vec2 a_texCoord;
      out vec2 v_texCoord;
      void main() {
        gl_Position = a_position;
        v_texCoord = vec2(a_texCoord.x, 1.0 - a_texCoord.y);
      }
    `;

    const fragmentShaderSource = `#version 300 es
      precision highp float;
      uniform sampler2D u_texture;
      in vec2 v_texCoord;
      out vec4 outColor;
      void main() {
        outColor = texture(u_texture, v_texCoord);
      }
    `;

    // Compilar shaders
    const vertexShader = this.compileShader(vertexShaderSource, this.gl.VERTEX_SHADER);
    const fragmentShader = this.compileShader(fragmentShaderSource, this.gl.FRAGMENT_SHADER);

    // Crear y linkear programa
    this.program = this.gl.createProgram();
    this.gl.attachShader(this.program, vertexShader);
    this.gl.attachShader(this.program, fragmentShader);
    this.gl.linkProgram(this.program);

    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
      throw new Error('Error al linkear programa WebGL');
    }

    // Configurar geometría
    const positions = new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1,
    ]);

    const texCoords = new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      1, 1,
    ]);

    // Crear y configurar buffers
    this.positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

    this.texCoordBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, texCoords, this.gl.STATIC_DRAW);

    // Configurar atributos
    this.positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
    this.texCoordLocation = this.gl.getAttribLocation(this.program, 'a_texCoord');

    // Crear y configurar textura
    this.texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
  }

  compileShader(source, type) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error('Error al compilar shader: ' + this.gl.getShaderInfoLog(shader));
    }

    return shader;
  }

  async resize(videoFrame) {
    const gl = this.gl;

    // Usar el programa WebGL
    gl.useProgram(this.program);

    // Configurar viewport
    gl.viewport(0, 0, this.targetWidth, this.targetHeight);

    // Configurar atributos
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.positionLocation);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(this.texCoordLocation);
    gl.vertexAttribPointer(this.texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    // Actualizar textura con el nuevo frame
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoFrame);

    // Dibujar
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    await this.waitForSync(gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0));

    // gl.flush();
    // gl.finish();

    // // Leer los píxeles redimensionados
    // const pixels = new Uint8Array(this.targetWidth * this.targetHeight * 4);
    // gl.readPixels(0, 0, this.targetWidth, this.targetHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // // Crear un nuevo VideoFrame con las dimensiones objetivo
    // const imageData = new ImageData(new Uint8ClampedArray(pixels), this.targetWidth, this.targetHeight);
    // const bitmap = await createImageBitmap(imageData);

    const bitmap = await createImageBitmap(this.canvas);

    const finalVideoFrame = new VideoFrame(bitmap, {
      timestamp: videoFrame.timestamp,
      duration: videoFrame.duration
    });

    bitmap.close();

    return finalVideoFrame;
  }

  waitForSync(sync) {
    return new Promise((resolve) => {
      const checkSync = () => {
        const status = this.gl.clientWaitSync(
          sync,
          this.gl.SYNC_FLUSH_COMMANDS_BIT,
          0 // no timeout
        );

        if (status === this.gl.TIMEOUT_EXPIRED) {
          // Todavía no está listo, intentar de nuevo en el próximo frame
          requestAnimationFrame(checkSync);
        } else if (status === this.gl.WAIT_FAILED) {
          // Error en la sincronización, resolver de todos modos
          resolve();
        } else {
          // Listo (ALREADY_SIGNALED o CONDITION_SATISFIED)
          resolve();
        }
      };

      checkSync();
    });
  }

  cleanup() {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteBuffer(this.positionBuffer);
    gl.deleteBuffer(this.texCoordBuffer);
    gl.deleteTexture(this.texture);
  }
}

class CrafyVideoJS {
  constructor(logs = false) {
    this.logs = logs;
    this.resetThisVariables();
  }

  resetThisVariables() {
    this.VIDEO_TIMESCALE = 90000;
    this.AUDIO_TIMESCALE = 48000;
    this.AUDIO_SAMPLERATE = 48000;
    this.AUDIO_SAMPLESIZE = 16;
    this.AUDIO_CHANNELCOUNT = 2;
    this.isFirstVideoSample = true;
    this.chunkOffset = 40;
    this.itsOnError = false;
  }

  onProgress(progressData) { }
  onError(error) { }
  onResult(result) { }

  in_onError(error) {
    this.itsOnError = true;
    this.onError(error);
  }

  /**
  * Process a video.
  * @param {ArrayBuffer} file - Input video file as ArrayBuffer.
  * @param {int} start_timestamp - (optional) Cut the video from this timestamp in microseconds.
  * @param {int} end_timestamp - (optional) Trim the video up to this timestamp in microseconds.
  * @param {int} max_video_bitrate - (optional) Max output video bitrate.
  * @param {int} max_video_resolution - (optional) Max output video width or height.
  * @param {int} queue_max_size - (optional) Max number of video chunks in queue at the same time.
  * @param {string} redimension_system - (optional) "webgl" | "bitmap"
  * @param {string} encoder_latencyMode - (optional) "quality" | "realtime"
  * @param {int} video_info_read_max_time - (optional) Maximum time in milliseconds to read the input video information.
  * @param {string} redimension_resizeQuality - (optional) "pixelated" | "low" | "medium" | "high"
  * @param {int} max_input_video_size - (optional) Max input video size in bytes.
  * @param {int} max_input_video_samplesCount - (optional) Max input video samples count.
  * @param {function} preprocess_video_info_function - (optional) Async function that receives the mp4box information from the input video and returns an object whose keys allow changing the rest of these parameters.
  * @param {string} output_video_codec - (optional) "avc1" | (experimental, not working: "hvc1")
  * @param {int} audio_queue_max_size - (optional) Max number of audio chunks in queue at the same time.
  */
  async processVideo({
    file,
    start_timestamp = false,
    end_timestamp = false,
    max_video_bitrate = false,
    max_video_resolution = false,
    queue_max_size = 10,
    redimension_system = 'bitmap',
    encoder_latencyMode = 'quality',
    video_info_read_max_time = 60000,
    redimension_resizeQuality = 'low',
    max_input_video_size = false,
    max_input_video_samplesCount = false,
    preprocess_video_info_function = false,
    output_video_codec = "avc1",
    audio_queue_max_size = 20
  } = {}) {
    this.resetThisVariables();
    var savedThis = this;

    if (preprocess_video_info_function === false) {
      preprocess_video_info_function = savedThis.helper_preprocess_video_info_function;
    }

    if (end_timestamp !== false && start_timestamp === false) {
      start_timestamp = 0;
    }

    if (start_timestamp !== false) {
      if (start_timestamp < 0) {
        start_timestamp = 0;
      }
    }

    if (start_timestamp !== false && end_timestamp !== false) {
      if (end_timestamp <= start_timestamp) {
        throw new Error("end_timestamp must be greater than start_timestamp.");
      }
    }

    const startNow = performance.now();

    if (savedThis.logs) console.log("Started!");

    let videoDecoder;
    let videoEncoder;
    let audioDecoder;
    let audioEncoder;

    let videoTrack = null;
    let audioTrack = null;
    let decodedVideoFrameIndex = 0;
    let encodedVideoFrameIndex = 0;
    let videoFrameCount = 0;
    let audioFrameCount = 0;
    let decodedAudioFrameIndex = 0;
    let encodedAudioFrameIndex = 0;
    let nextVideoKeyFrameTimestamp = 0;
    let nextAudioKeyFrameTimestamp = 0;
    let sampleVideoDurations = [];
    let sampleAudioDurations = [];
    let videoTrak = null;
    let audioTrak = null;

    let outputAudioCodec;

    let inputVideoBitrate;
    let inputAudioBitrate;
    let inputVideoSamplesNumber;

    let videoResizer;

    let encodedFinishedPromise;
    let encodedFinishedPromise_resolved = false;
    let encodedFinishedPromise_resolver;
    encodedFinishedPromise = new Promise((resolve) => {
      encodedFinishedPromise_resolver = resolve;
    });

    let encodedAudioFinishedPromise;
    let encodedAudioFinishedPromise_resolved = false;
    let encodedAudioFinishedPromise_resolver;
    encodedAudioFinishedPromise = new Promise((resolve) => {
      encodedAudioFinishedPromise_resolver = resolve;
    });

    let audioSendedToEncodeCount = 0;

    let mp4boxInputFileReadyPromise_resolver;
    let mp4boxInputFileReadyPromise = new Promise((resolve) => {
      mp4boxInputFileReadyPromise_resolver = resolve;
    });

    const mp4boxOutputFile = savedThis.createMP4File();
    savedThis.glob_mp4boxOutputFile = mp4boxOutputFile;
    const mp4boxInputFile = MP4Box.createFile();
    mp4boxInputFile.onError = (error) => { if (savedThis.logs) console.error(error) };
    mp4boxInputFile.onReady = async (info) => {
      if (savedThis.logs) console.log('mp4boxInputFile info', info);

      videoTrack = info.videoTracks[0];
      audioTrack = info.audioTracks[0];

      if (audioTrack && audioTrack.codec == "mp4a") {
        audioTrack.codec = "mp4a.40.2";
      }

      if (videoTrack) {
        if (max_input_video_samplesCount !== false) {
          if (videoTrack.nb_samples > max_input_video_samplesCount) {
            throw new Error("exceded_max_input_video_samplesCount");
          }
        }
      }

      preprocess_video_info_function(info).then((preprocess_video_info_response) => {
        if (Object.entries(preprocess_video_info_response).length > 0) {
          for (const [variableName, variableNewValue] of Object.entries(preprocess_video_info_response)) {
            eval(variableName + " = variableNewValue;");
          }
        }

        if (audioTrack) {
          outputAudioCodec = audioTrack.codec;
        }

        savedThis.getSupportedAudioBitrates(audioTrack, outputAudioCodec).then((supportedAudioBitrates) => {

          if (savedThis.logs) console.log('queue_max_size', queue_max_size, 'audio_queue_max_size', audio_queue_max_size);
  
          if (videoTrack) {
            savedThis.VIDEO_TIMESCALE = videoTrack.timescale;
            inputVideoBitrate = videoTrack.bitrate;
            inputVideoSamplesNumber = videoTrack.nb_samples;
    
            var videoResizeDimensions = false;
            var finalMaxVideoResolution = max_video_resolution;
            if (max_video_resolution !== false) {
              if (typeof max_video_resolution != 'number') {
                if (max_video_resolution['type'] == 'by_near_samplesCount') {
                  finalMaxVideoResolution = Math.round(max_video_resolution['data'][Object.keys(max_video_resolution['data'])[savedThis.findClosestIndex(Object.keys(max_video_resolution['data']), inputVideoSamplesNumber)]]);
                } else if (max_video_resolution['type'] == 'by_max_samplesCount') {
                  const sortedEntries = Object.entries(max_video_resolution['data']).sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
                  const sortedObj = Object.fromEntries(sortedEntries);
                  var newMaxVideoResolution = false;
                  for (const [samplesCountKey, maxResolutionItem] of Object.entries(sortedObj)) {
                    if (samplesCountKey != 0) {
                      if (inputVideoSamplesNumber <= samplesCountKey) {
                        newMaxVideoResolution = maxResolutionItem;
                        break;
                      }
                    }
                  }
                  if (newMaxVideoResolution !== false) {
                    finalMaxVideoResolution = newMaxVideoResolution;
                  } else {
                    if (max_video_resolution['data'][0] !== undefined) {
                      finalMaxVideoResolution = max_video_resolution['data'][0];
                    }
                  }
                }
              }
            }
            if (savedThis.logs) console.log('finalMaxVideoResolution', finalMaxVideoResolution);
            if (finalMaxVideoResolution !== false) {
              videoResizeDimensions = savedThis.getDimensionsForResize(videoTrack.track_width, videoTrack.track_height, finalMaxVideoResolution, true, true);
              if (videoResizeDimensions !== false) {
                if (redimension_system == 'webgl') {
                  videoResizer = new CrafyVideoJSWebGLImageManager(videoResizeDimensions.width, videoResizeDimensions.height);
                }
                if (savedThis.logs) console.log('Video redimension', videoResizeDimensions);
              }
            }
    
            var videoDecoder_isFirst = true;
            videoDecoder = new VideoDecoder({
              async output(inputFrame) {
    
                // const bitmap = await createImageBitmap(inputFrame);

                // const outputFrame = new VideoFrame(bitmap, {
                //   timestamp: inputFrame.timestamp,
                // });

                // const keyFrameEveryHowManySeconds = 2;
                // let keyFrame = false;
                // if (inputFrame.timestamp >= nextVideoKeyFrameTimestamp) {
                //   keyFrame = true;
                //   nextVideoKeyFrameTimestamp = inputFrame.timestamp + keyFrameEveryHowManySeconds * 1e6;
                // }
                // videoEncoder.encode(outputFrame, { keyFrame });
                // inputFrame.close();
                // outputFrame.close();

                // Debug:
                // videoDecoder_isFirst
                // if (true) {
                //   const canvas = document.createElement("canvas");
                //   const ctx = canvas.getContext("2d");
                //   canvas.width = inputFrame.codedWidth;
                //   canvas.height = inputFrame.codedHeight;
                //   ctx.drawImage(inputFrame, 0, 0);
                //   document.body.appendChild(canvas);
                // }
    
                var allowedFrame = true;
                if (start_timestamp !== false) {
                  if (inputFrame.timestamp < start_timestamp) {
                    allowedFrame = false;
                  }
                }
    
                var resizedFrame;

                if (allowedFrame) {
                  if (videoResizeDimensions !== false) {
                    if (redimension_system == 'webgl') {
                      resizedFrame = await videoResizer.resize(inputFrame);
                    } else if (redimension_system == 'bitmap') {
                      const bitmap = await createImageBitmap(inputFrame, {
                        resizeWidth: videoResizeDimensions.width,
                        resizeHeight: videoResizeDimensions.height,
                        resizeQuality: redimension_resizeQuality
                      });
                      resizedFrame = new VideoFrame(bitmap, {
                        timestamp: inputFrame.timestamp,
                        duration: inputFrame.duration
                      });
                      bitmap.close();
                    }
                    if (videoDecoder_isFirst) {
                      videoDecoder_isFirst = false;
                      videoEncoder.encode(resizedFrame, { keyFrame: true, timestamp: inputFrame.timestamp });
                    } else {
                      try {
                        videoEncoder.encode(resizedFrame, { timestamp: inputFrame.timestamp });
                      } catch (error) {
                        if (savedThis.logs) console.error(error);
                      }
                    }
                  } else {
                    const bitmap = await createImageBitmap(inputFrame, {
                      resizeWidth: inputFrame.codedWidth,
                      resizeHeight: inputFrame.codedHeight,
                      resizeQuality: redimension_resizeQuality
                    });
                    resizedFrame = new VideoFrame(bitmap, {
                      timestamp: inputFrame.timestamp,
                      duration: inputFrame.duration
                    });
                    bitmap.close();
                    if (videoDecoder_isFirst) {
                      videoDecoder_isFirst = false;
                      videoEncoder.encode(resizedFrame, { keyFrame: true, timestamp: inputFrame.timestamp });
                    } else {
                      videoEncoder.encode(resizedFrame, { timestamp: inputFrame.timestamp });
                    }
                  }
                } else {
                  videoFrameCount--;
                }
                try {
                  if (resizedFrame !== undefined) {
                    resizedFrame.close();
                  }
                  inputFrame.close();
                } catch (error) { }
    
                decodedVideoFrameIndex++;
                displayProgress();
              },
              error(error) {
                if (savedThis.logs) console.error(error);
              }
            });
    
            let description;
            const trak = mp4boxInputFile.getTrackById(videoTrack.id);
            for (const entry of trak.mdia.minf.stbl.stsd.entries) {
              if (entry.avcC || entry.hvcC) {
                const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
                if (entry.avcC) {
                  entry.avcC.write(stream);
                } else {
                  entry.hvcC.write(stream);
                }
                description = new Uint8Array(stream.buffer, 8); // Remove the box header.
                break;
              }
            }
    
            videoDecoder.configure({
              codec: videoTrack.codec,
              codedWidth: videoTrack.track_width,
              codedHeight: videoTrack.track_height,
              hardwareAcceleration: 'prefer-hardware',
              description,
            });
    
            var outputVideoDimensions = {
              'width': videoTrack.track_width,
              'height': videoTrack.track_height
            };
            if (videoResizeDimensions !== false) {
              outputVideoDimensions.width = videoResizeDimensions.width;
              outputVideoDimensions.height = videoResizeDimensions.height;
            }
  
            let videoTotalResolution = outputVideoDimensions.width * outputVideoDimensions.height;
            let newVideoBitrate = Math.round(inputVideoBitrate);
            if (max_video_bitrate !== false) {
              if (typeof max_video_bitrate == 'number') {
                if (newVideoBitrate > max_video_bitrate) {
                  newVideoBitrate = Math.round(max_video_bitrate);
                }
              } else {
                if (max_video_bitrate['type'] == 'percentage_of_original') {
                  newVideoBitrate = Math.round(newVideoBitrate / 100 * max_video_bitrate['percentage']);
                } else if (max_video_bitrate['type'] == 'max_by_resolution') {
                  let localMaxVideoBitrate = max_video_bitrate['data'][Object.keys(max_video_bitrate['data'])[savedThis.findClosestIndex(Object.keys(max_video_bitrate['data']), videoTotalResolution)]];
                  if (newVideoBitrate > localMaxVideoBitrate) {
                    newVideoBitrate = Math.round(localMaxVideoBitrate);
                  }
                } else if (max_video_bitrate['type'] == 'percentage_of_original_by_resolution') {
                  newVideoBitrate = Math.round(newVideoBitrate / 100 * max_video_bitrate['data'][Object.keys(max_video_bitrate['data'])[savedThis.findClosestIndex(Object.keys(max_video_bitrate['data']), videoTotalResolution)]]);
                } else if (max_video_bitrate['type'] == 'percentage_and_max_of_original_by_resolution') {
                  let indexData = max_video_bitrate['data'][Object.keys(max_video_bitrate['data'])[savedThis.findClosestIndex(Object.keys(max_video_bitrate['data']), videoTotalResolution)]];
                  newVideoBitrate = Math.round(newVideoBitrate / 100 * indexData['percentage']);
                  if (newVideoBitrate > indexData['max']) {
                    newVideoBitrate = Math.round(indexData['max']);
                  }
                }
              }
            }
  
            if (savedThis.logs) console.log('newVideoBitrate', newVideoBitrate);
  
            var outputVideoCodec;
            
            if (output_video_codec == 'avc1') {
              outputVideoCodec = savedThis.getAVCCodec(outputVideoDimensions.width, outputVideoDimensions.height, newVideoBitrate);
            } else if (output_video_codec == 'hvc1') {
              outputVideoCodec = savedThis.getHVC1Codec(outputVideoDimensions.width, outputVideoDimensions.height, newVideoBitrate);
            }

            if (savedThis.logs) console.log('outputVideoCodec', outputVideoCodec);
  
            videoEncoder = new VideoEncoder({
              output(chunk, metadata) {
                let uint8 = new Uint8Array(chunk.byteLength);
                chunk.copyTo(uint8);
    
                if (videoTrak === null) {
                  let addTrakData = {
                    type: 'video',
                    width: outputVideoDimensions.width,
                    height: outputVideoDimensions.height,
                    codec: outputVideoCodec
                  };
                  if (output_video_codec == 'avc1') {
                    addTrakData.avcDecoderConfigRecord = metadata.decoderConfig.description;
                  } else if (output_video_codec == 'hvc1') {
                    addTrakData.hvcDecoderConfigRecord = metadata.decoderConfig.description;
                    addTrakData.hevcParams = {
                      profileSpace: 0,
                      tierFlag: 0,
                      profileIdc: 1,
                      profileCompatibility: 0x60000000,
                      levelIdc: 93, // Level 3.1
                      constraintIndicatorFlags: new Uint8Array([0x90, 0x00, 0x00, 0x00, 0x00, 0x00]),
                      chromaFormat: 1, // 4:2:0
                      bitDepth: 8
                    };
                  }

                  videoTrak = savedThis.addTrak(
                    mp4boxOutputFile,
                    addTrakData,
                    output_video_codec
                  );
                }
    
                const sampleDuration = sampleVideoDurations.shift() / (1_000_000 / savedThis.VIDEO_TIMESCALE);
                savedThis.addSample(
                  mp4boxOutputFile,
                  videoTrak,
                  uint8,
                  chunk.type === 'key',
                  sampleDuration,
                  /* addDuration */ true,
                  output_video_codec,
                  metadata
                );
    
                encodedVideoFrameIndex++;
                displayProgress();
              },
              error(error) {
                if (savedThis.logs) console.error(error);
                savedThis.in_onError(error);
              }
            });

            if (savedThis.logs) console.log('videoEncoder.configure', JSON.stringify({
              codec: outputVideoCodec,
              width: outputVideoDimensions.width,
              height: outputVideoDimensions.height,
              hardwareAcceleration: 'prefer-hardware',
              bitrate: newVideoBitrate,
              bitrateMode: 'variable',
              alpha: 'discard',
              latencyMode: encoder_latencyMode,
            }));
    
            videoEncoder.configure({
              codec: outputVideoCodec,
              width: outputVideoDimensions.width,
              height: outputVideoDimensions.height,
              hardwareAcceleration: 'prefer-hardware',
              bitrate: newVideoBitrate,
              bitrateMode: 'variable',
              alpha: 'discard',
              latencyMode: encoder_latencyMode
            });
    
            mp4boxInputFile.setExtractionOptions(videoTrack.id, null, { nbSamples: Infinity });
          }
    
          if (audioTrack) {
            savedThis.AUDIO_TIMESCALE = audioTrack.timescale;
            savedThis.AUDIO_SAMPLERATE = audioTrack.audio.sample_rate;
            savedThis.AUDIO_SAMPLESIZE = audioTrack.audio.sample_size;
            savedThis.AUDIO_CHANNELCOUNT = audioTrack.audio.channel_count;
            inputAudioBitrate = audioTrack.bitrate;
            var audioDecoder_isFirst = true;
            audioDecoder = new AudioDecoder({
              async output(audioData) {
  
                if (savedThis.itsOnError) {
                  return false;
                }
    
                var allowedFrame = true;
                if (start_timestamp !== false) {
                  if (audioData.timestamp < start_timestamp) {
                    allowedFrame = false;
                  }
                }
    
                if (allowedFrame) {
                  if (audioDecoder_isFirst) {
                    audioDecoder_isFirst = false;
                    audioEncoder.encode(audioData, { keyFrame: true });
                  } else {
                    audioEncoder.encode(audioData);
                  }
                  audioSendedToEncodeCount++;
                } else {
                  audioFrameCount--;
                }
                audioData.close();
    
                decodedAudioFrameIndex++;
                displayProgress();
              },
              error(error) {
                if (savedThis.logs) console.error(error);
              }
            });
    
            var audioCodec = audioTrack.codec;

            let audio_description;
            const audio_trak = mp4boxInputFile.getTrackById(audioTrack.id);
            for (const entry of audio_trak.mdia.minf.stbl.stsd.entries) {
              if (entry.dOps) {
                const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
                if (entry.dOps) {
                  entry.dOps.write(stream);
                }
                audio_description = new Uint8Array(stream.buffer); // Remove the box header.
                break;
              }
            }
    
            var audioDecoderConfigParams = {
              codec: audioCodec,
              numberOfChannels: audioTrack.audio.channel_count,
              sampleRate: audioTrack.audio.sample_rate,
            };

            if (audio_description !== undefined) {
              audioDecoderConfigParams.description = audio_description;
            }

            audioDecoder.configure(audioDecoderConfigParams);
    
            audioEncoder = new AudioEncoder({
              output(chunk, metadata) {
                let uint8 = new Uint8Array(chunk.byteLength);
                chunk.copyTo(uint8);                
    
                if (audioTrak === null) {
                  audioTrak = savedThis.addTrak(
                    mp4boxOutputFile,
                    {
                      type: 'audio',
                      codec: outputAudioCodec,
                      audioAvgBitrate: newAudioBitrate,
                      decoderConfig_description: audio_description
                    },
                    output_video_codec
                  );
                }
    
                const sampleDuration = sampleAudioDurations.shift() / (1_000_000 / savedThis.AUDIO_TIMESCALE);
                savedThis.addSample(
                  mp4boxOutputFile,
                  audioTrak,
                  uint8,
                  chunk.type === 'key',
                  sampleDuration,
                  /* addDuration */ !videoTrack,
                );
    
                encodedAudioFrameIndex++;
                displayProgress();
              },
              error(error) {
                if (savedThis.logs) console.error(error);
                savedThis.in_onError(error);
              }
            });
  
            if (savedThis.logs) console.log('outputAudioCodec', outputAudioCodec);
            if (savedThis.logs) console.log('supportedAudioBitrates', supportedAudioBitrates);
            var newAudioBitrate = supportedAudioBitrates[savedThis.findClosestIndex(supportedAudioBitrates, Math.round(audioTrack.bitrate))];
            if (savedThis.logs) console.log('newAudioBitrate', newAudioBitrate);
          
            audioEncoder.configure({
              codec: outputAudioCodec,
              numberOfChannels: audioTrack.audio.channel_count,
              sampleRate: audioTrack.audio.sample_rate,
              bitrate: Math.round(newAudioBitrate),
              bitratemode: "variable"
            });
    
            mp4boxInputFile.setExtractionOptions(audioTrack.id, null, { nbSamples: Infinity });
          }
    
          mp4boxInputFile.start();
  
          mp4boxInputFileReadyPromise_resolver();
  
        });
      });
    };

    // ETA in ms
    var video_eta = {
      'decoding_percentage': 0,
      'decoding_eta': null,
      'encoding_percentage': 0,
      'encoding_eta': null,
      'total_percentage': 0,
      'total_eta': null
    };
    function displayProgress() {
      var progressData = {};
      if (videoTrack) {
        let elapsed_time_ms = Math.round(performance.now()) - Math.round(startNow);
        let video_decoding_percentage = Math.round(100 * decodedVideoFrameIndex / videoFrameCount);
        if (video_decoding_percentage > video_eta['decoding_percentage']) {
          video_eta['decoding_percentage'] = video_decoding_percentage;
          if (video_decoding_percentage >= 100) {
            video_eta['decoding_eta'] = 0;
          } else {
            video_eta['decoding_eta'] = (elapsed_time_ms * 100 / video_decoding_percentage) - elapsed_time_ms;
          }
        }
        let video_encoding_percentage = Math.round(100 * encodedVideoFrameIndex / videoFrameCount);
        if (video_encoding_percentage > video_eta['encoding_percentage']) {
          video_eta['encoding_percentage'] = video_encoding_percentage;
          if (video_encoding_percentage >= 100) {
            video_eta['encoding_eta'] = 0;
          } else {
            video_eta['encoding_eta'] = (elapsed_time_ms * 100 / video_encoding_percentage) - elapsed_time_ms;
          }
        }
        let video_total_percentage = video_decoding_percentage + video_encoding_percentage;
        if (video_total_percentage > video_eta['total_percentage']) {
          video_eta['total_percentage'] = video_total_percentage;
          if (video_total_percentage >= 200) {
            video_eta['total_eta'] = 0;
          } else {
            video_eta['total_eta'] = ((elapsed_time_ms * 200 / video_total_percentage) * 1.1) - elapsed_time_ms;
          }
        }
        progressData['video'] = {
          'decoding': {
            'index': decodedVideoFrameIndex,
            'count': videoFrameCount,
            'percentage': video_decoding_percentage,
            'percentage_original': 100 * decodedVideoFrameIndex / videoFrameCount,
            'eta': video_eta['decoding_eta']
          },
          'encoding': {
            'index': encodedVideoFrameIndex,
            'count': videoFrameCount,
            'percentage': video_encoding_percentage,
            'percentage_original': 100 * encodedVideoFrameIndex / videoFrameCount,
            'eta': video_eta['encoding_eta']
          },
          'eta': video_eta['total_eta']
        };
      }
      if (audioTrack) {
        progressData['audio'] = {
          'decoding': {
            'index': decodedAudioFrameIndex,
            'count': audioFrameCount,
            'percentage': Math.round(100 * decodedAudioFrameIndex / audioFrameCount),
            'percentage_original': 100 * decodedAudioFrameIndex / audioFrameCount
          },
          'encoding': {
            'index': encodedAudioFrameIndex,
            'count': audioFrameCount,
            'percentage': Math.round(100 * encodedAudioFrameIndex / audioFrameCount),
            'percentage_original': 100 * encodedAudioFrameIndex / audioFrameCount
          }
        };
      }
      savedThis.onProgress(progressData);
    }

    function findNearestKeyframe(samples, startTime, timescale) {
      // Convertimos startTime a unidades de cts usando el timescale
      const targetCts = startTime * timescale / 1_000_000;

      // Inicializamos las variables de búsqueda
      let nearestKeyframe = null;

      for (const sample of samples) {
        // Verificamos si es un keyframe
        if (sample.is_sync) {
          // Si es el primer keyframe o está más cerca del targetCts, lo guardamos
          if (!nearestKeyframe || sample.cts <= targetCts) {
            nearestKeyframe = sample;
          } else {
            // Si encontramos un keyframe posterior al target, dejamos de buscar
            break;
          }
        }
      }

      // Verificamos que encontramos un keyframe válido
      if (!nearestKeyframe) {
        throw new Error("No keyframe found before the specified startTime.");
      }

      return {
        keyframe: nearestKeyframe,
        timestamp: nearestKeyframe.cts * 1_000_000 / timescale, // Convertimos a microsegundos
      };
    }

    function filterFramesByRange(frames, startTime, endTime, timescale, keyframeCts) {
      if (savedThis.logs) console.log('filterFramesByRange timescale', timescale);

      // Convertimos los tiempos a cts (unidades del timescale)
      const startCts = (startTime * timescale) / 1_000_000;
      var endCts = Infinity;
      if (endTime !== false) {
        endCts = (endTime * timescale) / 1_000_000;
      }

      if (savedThis.logs) console.log('cts', startCts, endCts);
      if (savedThis.logs) console.log('keyframeCts', keyframeCts);

      const filteredFrames = frames.filter((frame) => {
        return frame.cts >= keyframeCts && frame.cts <= endCts;
      });

      return filteredFrames;
    }

    var groupsOfVideoChunks;
    var groupsOfAudioChunks;

    mp4boxInputFile.onSamples = function (track_id, ref, samples) {
      if (savedThis.itsOnError) {
        return false;
      }
      let filteredFrames = samples;
      if (start_timestamp !== false) {
        const nearestKeyframeInfo = findNearestKeyframe(samples, start_timestamp, samples[0].timescale);
        filteredFrames = filterFramesByRange(samples, start_timestamp, end_timestamp, samples[0].timescale, nearestKeyframeInfo.keyframe.cts);
      }
      // console.log('filteredFrames', filteredFrames);
      let videoChunks = [];
      let audioChunks = [];
      for (const sample of filteredFrames) {
        const chunk = {
          type: sample.is_sync ? "key" : "delta",
          timestamp: sample.cts * 1_000_000 / sample.timescale,
          duration: sample.duration * 1_000_000 / sample.timescale,
          data: sample.data
        };
        if (videoTrack && track_id === videoTrack.id) {
          videoFrameCount++;
          sampleVideoDurations.push(sample.duration * 1_000_000 / sample.timescale);
          videoChunks.push(chunk);

          // videoDecoder.decode(new EncodedVideoChunk(chunk));
        } else if (audioTrack && track_id === audioTrack.id) {
          audioFrameCount++;
          sampleAudioDurations.push(sample.duration * 1_000_000 / sample.timescale);
          audioChunks.push(chunk);

          // audioDecoder.decode(new EncodedAudioChunk(chunk));
        }
      }
      filteredFrames = null;
      if (videoChunks.length > 0) {
        groupsOfVideoChunks = splitGroupOfVideoChunks(videoChunks);
        processGroupsOfVideoChunks();
      }
      if (audioChunks.length > 0) {
        groupsOfAudioChunks = [audioChunks];
        processGroupsOfAudioChunks();
      }
    }

    async function processGroupsOfVideoChunks() {
      for (const groupOfChunks of groupsOfVideoChunks) {
        for (const chunkItem of groupOfChunks) {
          if (savedThis.itsOnError) {
            return false;
          }
          var whileController = true;
          while (whileController) {
            if (videoDecoder.decodeQueueSize < queue_max_size && videoEncoder.encodeQueueSize < queue_max_size) {
              try {
                videoDecoder.decode(new EncodedVideoChunk(chunkItem));
              } catch (error) {
                savedThis.in_onError(error);
                throw new Error("Decode frame error.");
              }
              whileController = false;
            } else {
              await sleep(1);
            }
          }
        }
        await videoDecoder.flush();
      }
      videoDecoder.close();

      let whileController_ii = true;
      while (whileController_ii) {
        if (videoEncoder.encodeQueueSize == 0) {
          whileController_ii = false;
          encodedFinishedPromise_resolved = true;
          encodedFinishedPromise_resolver();
        } else {
          await sleep(3);
        }
      }

    }

    async function processGroupsOfAudioChunks() {
      let sendedToDecodeCount = 0;
      for (const groupOfChunks of groupsOfAudioChunks) {
        for (const chunkItem of groupOfChunks) {
          if (savedThis.itsOnError) {
            return false;
          }
          var whileController = true;
          while (whileController) {
            if (audioDecoder.decodeQueueSize < audio_queue_max_size && audioEncoder.encodeQueueSize < audio_queue_max_size) {
              try {
                audioDecoder.decode(new EncodedAudioChunk(chunkItem));
                sendedToDecodeCount++;
              } catch (error) {
                if (savedThis.logs) console.error("Decode audio sample error.", error);
                savedThis.in_onError(error);
                throw new Error("Decode audio sample error.");
              }
              whileController = false;
            } else {
              await sleep(1);
            }
          }
        }
        await audioDecoder.flush();
      }
      audioDecoder.close();

      let whileController_ii = true;
      while (whileController_ii) {
        if (audioEncoder.encodeQueueSize == 0) {
          whileController_ii = false;
          encodedAudioFinishedPromise_resolved = true;
          encodedAudioFinishedPromise_resolver();
        } else {
          await sleep(3);
        }
      }

    }

    async function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    function splitGroupOfVideoChunks(videoChunks) {
      return [videoChunks];
      // This doesn't work in certain scenarios.
      // The original goal of this strategy was to avoid VRAM overload, but that was fixed with queue_max_size.
      let resultado = [];
      var lastGroup = [];
      for (const videoChunk of videoChunks) {
        if (videoChunk.type == 'key') {
          if (lastGroup.length > 0) {
            resultado.push(lastGroup);
          }
          lastGroup = [videoChunk];
        } else {
          lastGroup.push(videoChunk);
        }
      }
      if (lastGroup.length > 0) {
        resultado.push(lastGroup);
      }
      return resultado;
    }

    async function onComplete() {

      var finalResult = {};

      finalResult['video_array_buffer'] = mp4boxOutputFile.getBuffer();
      const seconds = (performance.now() - startNow) / 1000;
      finalResult['reencoding_time_seconds'] = seconds;
      if (videoTrack) {
        finalResult['reencoding_video_frames'] = encodedVideoFrameIndex;
        finalResult['reencoding_video_fps'] = Math.round(encodedVideoFrameIndex / seconds);
      }
      if (audioTrack) {
        finalResult['reencoding_audio_frames'] = encodedAudioFrameIndex;
        finalResult['reencoding_audio_fps'] = Math.round(encodedAudioFrameIndex / seconds);
      }

      if (videoTrack === null && audioTrack === null) {
        throw new Error("Can't decodify video.");
      }

      return finalResult;

    };

    try {

      if (max_input_video_size !== false) {
        if (file.byteLength > max_input_video_size) {
          throw new Error("exceded_max_input_video_size");
        }
      }

      file.fileStart = 0;

      if (savedThis.logs) console.log("reader.onload");

      var readingVideoInfoError = false;
      var readingMaxTimeTimer = setTimeout(() => {
        readingVideoInfoError = true;
        mp4boxInputFileReadyPromise_resolver();
      }, video_info_read_max_time);

      mp4boxInputFile.appendBuffer(file);
      mp4boxInputFile.flush();
      await mp4boxInputFileReadyPromise;
      if (readingVideoInfoError) {
        throw new Error("exceded_video_info_read_max_time");
      }
      clearTimeout(readingMaxTimeTimer);

      if (savedThis.logs) console.log("reader.onload 2");

      // if (videoTrack) {
      //   await videoDecoder.flush();
      //   videoDecoder.close();
      // }
      // if (audioTrack) {
      //   await audioDecoder.flush();
      //   audioDecoder.close();
      // }

      if (savedThis.logs) console.log("reader.onload 3");

      if (videoTrack) {
        // await videoEncoder.flush();
        if (!encodedFinishedPromise_resolved) {
          await encodedFinishedPromise;
        }
        videoEncoder.close();
      }
      if (audioTrack) {        
        // await audioEncoder.flush();
        if (!encodedAudioFinishedPromise_resolved) {
          await encodedAudioFinishedPromise;
        }
        audioEncoder.close();
      }

      if (videoResizer !== undefined) {
        videoResizer.cleanup();
      }

      if (savedThis.logs) console.log("reader.onload 4");

      var result = await onComplete();
      savedThis.onResult(result);

    } catch (error) {
      savedThis.in_onError(error);
    }

  }

  createMP4File() {
    const mp4File = MP4Box.createFile();

    const ftyp = mp4File.add("ftyp")
      .set("major_brand", "mp42")
      .set("minor_version", 0)
      .set("compatible_brands", ["mp42", "isom"]);

    const free = mp4File.add("free");

    const mdat = mp4File.add("mdat");
    mp4File.mdat = mdat;
    mdat.parts = [];
    mdat.write = function (stream) {
      this.size = this.parts.map(part => part.byteLength).reduce((a, b) => a + b, 0);
      this.writeHeader(stream);
      this.parts.forEach(part => {
        stream.writeUint8Array(part);
      });
    }

    const moov = mp4File.add("moov");

    const mvhd = moov.add("mvhd")
      .set("timescale", 1000)
      .set("rate", 1 << 16)
      .set("creation_time", 0)
      .set("modification_time", 0)
      .set("duration", 0)
      .set("volume", 1)
      .set("matrix", [
        1 << 16, 0, 0, //
        0, 1 << 16, 0, //
        0, 0, 0x40000000
      ])
      .set("next_track_id", 1);

    return mp4File;
  }

  addTrak(mp4File, config, output_video_codec) {
    var savedThis = this;

    const isVideo = config.type === "video";

    if (!isVideo) {      
      mp4File.addTrack({
        id: 2,
        type: 'audio',
        codec: config.codec,
        language: 'und',
        timescale: this.AUDIO_TIMESCALE,
        channel_count: this.AUDIO_CHANNELCOUNT,
        samplesize: this.AUDIO_SAMPLESIZE,
        samplerate: this.AUDIO_SAMPLERATE,
        duration: undefined
      });
      savedThis.audio_track = mp4File.getTrackById(2);
      savedThis.audio_track.mdia.hdlr
        .set("handler", "soun")
        .set("name", "");
      savedThis.audio_track.mdia.minf.add("smhd")
        .set("flags", 1)
        .set("balance", 0);
      const dinf = savedThis.audio_track.mdia.minf.add("dinf");
      const url = new BoxParser["url Box"]()
        .set("flags", 0x1);
      dinf.add("dref")
        .addEntry(url);
      var stbl = savedThis.audio_track.mdia.minf.add("stbl");
      const stsd_i = stbl.add("stsd")
        .set("version", 0)
        .set("flags", 0);
      const codecParts = config.codec.split(".");
      const codecType = codecParts[0];
      if (codecType.toLowerCase() === "mp4a") {
        var mp4a = new BoxParser.mp4aSampleEntry()
          .set("data_reference_index", 1)
          .set("channel_count", savedThis.AUDIO_CHANNELCOUNT)
          .set("samplesize", savedThis.AUDIO_SAMPLESIZE)
          .set("samplerate", savedThis.AUDIO_SAMPLERATE);
        const esds = new BoxParser.esdsBox();
        mp4a.esds = esds;
        mp4a.esds.version = 0;
        // TODO: Set exact audio codec. Now, mp4a is always "mp4a" insead "mp4a.40.2" for example.
        // (idk how to do it)
        stsd_i.addEntry(mp4a);
        stsd_i.entries[0].type = config.codec;
      } else if (codecType === "ac-3" || codecType === "ec-3") {
        // TODO: not supported!
        // var ac3 = new BoxParser.ac3SampleEntry()
        //   .set("data_reference_index", 1);
        // stsd_i.addEntry(ac3);
      } else if (codecType.toLowerCase() === "opus") {
        var opus = new BoxParser.OpusSampleEntry()
          .set("data_reference_index", 1)
          .set("channel_count", savedThis.AUDIO_CHANNELCOUNT)
          .set("samplesize", savedThis.AUDIO_SAMPLESIZE)
          .set("samplerate", savedThis.AUDIO_SAMPLERATE);        

        var dOpsBox = new BoxParser.dOpsBox();
        var stream = new MP4BoxStream(config.decoderConfig_description.buffer);
        dOpsBox.parse(stream);
        opus.addBox(dOpsBox);

        stsd_i.addEntry(opus);
        stsd_i.entries[0].type = config.codec;
      } else if (codecType.toLowerCase() === "alac") {
        // TODO: not supported!
        // var alac = new BoxParser.alacSampleEntry()
        //   .set("data_reference_index", 1);
        // stsd_i.addEntry(alac);
      }
      const stts = stbl.add("stts")
        .set("sample_counts", [])
        .set("sample_deltas", []);
      const stsc = stbl.add("stsc")
        .set("first_chunk", [1])
        .set("samples_per_chunk", [1])
        .set("sample_description_index", [1]);
      const stsz = stbl.add("stsz")
        .set("sample_sizes", []);
      const stco = stbl.add("stco")
        .set("chunk_offsets", []);
      return mp4File.getTrackById(2);
    }

    const moov = mp4File.moov;
    const trak = moov.add("trak");

    savedThis.video_track = trak;

    const id = moov.mvhd.next_track_id;
    moov.mvhd.next_track_id++;

    const tkhd = trak.add("tkhd")
      .set("flags",
        BoxParser.TKHD_FLAG_ENABLED |
        BoxParser.TKHD_FLAG_IN_MOVIE |
        BoxParser.TKHD_FLAG_IN_PREVIEW
      )
      .set("creation_time", 0)
      .set("modification_time", 0)
      .set("track_id", id)
      .set("duration", 0)
      .set("layer", 0)
      .set("alternate_group", 0)
      .set("volume", 1)
      .set("matrix", [
        1 << 16, 0, 0, //
        0, 1 << 16, 0, //
        0, 0, 0x40000000
      ])
      .set("width", (config.width || 0) << 16)
      .set("height", (config.height || 0) << 16);

    const mdia = trak.add("mdia");

    const mdhd = mdia.add("mdhd")
      .set("creation_time", 0)
      .set("modification_time", 0)
      .set("timescale", isVideo ? savedThis.VIDEO_TIMESCALE : savedThis.AUDIO_TIMESCALE)
      .set("duration", 0)
      .set("language", 21956)
      .set("languageString", "und");

    const hdlr = mdia.add("hdlr")
      .set("handler", isVideo ? "vide" : "soun")
      .set("name", "");

    const minf = mdia.add("minf");

    if (isVideo) {
      const vmhd = minf.add("vmhd")
        .set("graphicsmode", 0)
        .set("opcolor", [0, 0, 0]);
    } else {
      const smhd = minf.add("smhd")
        .set("flags", 1)
        .set("balance", 0);
    }

    const dinf = minf.add("dinf");
    const url = new BoxParser["url Box"]()
      .set("flags", 0x1);
    const dref = dinf.add("dref")
      .addEntry(url);

    var stbl = minf.add("stbl");

    if (isVideo) {
      var sample_description_entry;

      if (output_video_codec == 'avc1') {
        sample_description_entry = new BoxParser.avc1SampleEntry();
        sample_description_entry.data_reference_index = 1;
        sample_description_entry
          .set("width", config.width || 0)
          .set("height", config.height || 0)
          .set("horizresolution", 0x48 << 16)
          .set("vertresolution", 0x48 << 16)
          .set("frame_count", 1)
          .set("compressorname", "")
          .set("depth", 0x18);
  
        var avcC = new BoxParser.avcCBox();
        var stream = new MP4BoxStream(config.avcDecoderConfigRecord);
        avcC.parse(stream);
        sample_description_entry.addBox(avcC);
      } else if (output_video_codec == 'hvc1') {
        sample_description_entry = new BoxParser.hvc1SampleEntry();
        sample_description_entry.data_reference_index = 1;
        sample_description_entry
          .set("width", config.width || 0)
          .set("height", config.height || 0)
          .set("horizresolution", 0x48 << 16)
          .set("vertresolution", 0x48 << 16)
          .set("frame_count", 1)
          .set("compressorname", "")
          .set("depth", 0x18);

        // Add HDR metadata if available
        if (config.hdrMetadata) {
          // Add HDR color information box (colr)
          const colr = new BoxParser.colrBox();
          colr.colour_type = 'nclx';
          colr.colour_primaries = config.hdrMetadata.colorPrimaries || 9; // BT.2020
          colr.transfer_characteristics = config.hdrMetadata.transferCharacteristics || 16; // PQ
          colr.matrix_coefficients = config.hdrMetadata.matrixCoefficients || 9; // BT.2020
          colr.full_range_flag = config.hdrMetadata.fullRange || true;
          sample_description_entry.addBox(colr);

          // Add HDR metadata box (mdcv) if mastering display metadata is available
          if (config.hdrMetadata.masteringDisplayData) {
            const mdcv = new BoxParser.mdcvBox();
            mdcv.display_primaries = config.hdrMetadata.masteringDisplayData.primaries;
            mdcv.white_point = config.hdrMetadata.masteringDisplayData.whitePoint;
            mdcv.max_display_mastering_luminance = config.hdrMetadata.masteringDisplayData.maxLuminance;
            mdcv.min_display_mastering_luminance = config.hdrMetadata.masteringDisplayData.minLuminance;
            sample_description_entry.addBox(mdcv);
          }

          // Add content light level box (clli) if available
          if (config.hdrMetadata.contentLightLevel) {
            const clli = new BoxParser.clliBox();
            clli.max_content_light_level = config.hdrMetadata.contentLightLevel.maxCLL;
            clli.max_pic_average_light_level = config.hdrMetadata.contentLightLevel.maxFALL;
            sample_description_entry.addBox(clli);
          }
        }

        var hvcC = new BoxParser.hvcCBox();
        if (savedThis.logs) console.log('config.hvcDecoderConfigRecord', config.hvcDecoderConfigRecord);
        var stream = new MP4BoxStream(config.hvcDecoderConfigRecord);
        hvcC.parse(stream);

        // Add specific HEVC parameters if available
        if (config.hevcParams) {
          hvcC.general_profile_space = config.hevcParams.profileSpace || 0;
          hvcC.general_tier_flag = config.hevcParams.tierFlag || 0;
          hvcC.general_profile_idc = config.hevcParams.profileIdc || 1;
          hvcC.general_profile_compatibility = config.hevcParams.profileCompatibility || 0;
          hvcC.general_level_idc = config.hevcParams.levelIdc || 120;
        }

        sample_description_entry.addBox(hvcC);
      }

      const stsd = stbl.add("stsd")
        .addEntry(sample_description_entry);
    }

    const stts = stbl.add("stts")
      .set("sample_counts", [])
      .set("sample_deltas", []);

    if (isVideo) {
      const stss = stbl.add("stss")
        .set("sample_numbers", [])
    }

    const stsc = stbl.add("stsc")
      .set("first_chunk", [1])
      .set("samples_per_chunk", [1])
      .set("sample_description_index", [1]);

    const stsz = stbl.add("stsz")
      .set("sample_sizes", []);

    const stco = stbl.add("stco")
      .set("chunk_offsets", []);

    return trak;
  }

  addSample(mp4File, trak, data, isSync, duration, addDuration, output_video_codec = null, metadata = null) {
    var savedThis = this;

    const isVideo = trak.mdia.hdlr.handler === 'vide';
    var isHEVC = false;
    try {
      isHEVC = trak.mdia.minf.stbl.stsd.entries[0].type === 'hvc1';
    } catch (error) {}

    if (savedThis.isFirstVideoSample && isVideo) {
      savedThis.isFirstVideoSample = false;
      const headerSize = 4 + data[0] << 24 + data[1] << 16 + data[2] << 8 + data[3];
      data = data.slice(headerSize);
    }

    if (isVideo && isHEVC) {
      // TODO: custom managment for hvc1
    }

    mp4File.mdat.parts.push(data);

    const scaledDuration = duration / (isVideo ? savedThis.VIDEO_TIMESCALE : savedThis.AUDIO_TIMESCALE) * 1000;
    trak.samples_duration += scaledDuration;
    trak.tkhd.duration += scaledDuration;
    trak.mdia.mdhd.duration += duration;
    if (addDuration) {
      mp4File.moov.mvhd.duration += scaledDuration;
    }

    const stbl = trak.mdia.minf.stbl;

    let index = stbl.stts.sample_deltas.length - 1;
    if (stbl.stts.sample_deltas[index] !== duration) {
      stbl.stts.sample_deltas.push(duration);
      stbl.stts.sample_counts.push(1);
    } else {
      stbl.stts.sample_counts[index]++;
    }

    if (isVideo && isSync) {
      stbl.stss.sample_numbers.push(
        stbl.stts.sample_counts.reduce((a, b) => a + b)
      );
    }

    stbl.stco.chunk_offsets.push(savedThis.chunkOffset);
    savedThis.chunkOffset += data.byteLength;

    stbl.stsz.sample_sizes.push(data.byteLength);
    stbl.stsz.sample_count++;
  }

  findClosestIndex(array, target) {
    let closestIndex = -1;
    let smallestDifference = Infinity;

    array.forEach((num, index) => {
      const difference = Math.abs(num - target);
      if (difference < smallestDifference) {
        smallestDifference = difference;
        closestIndex = index;
      }
    });

    return closestIndex;
  }

  getDimensionsForResize(originalWidth, originalHeight, maxSize, falseOnNoExcess = false, mustBeEven = false) {
    // Si la imagen ya está dentro de los límites, no cambiar el tamaño
    if (originalWidth <= maxSize && originalHeight <= maxSize) {
      if (falseOnNoExcess) {
        return false;
      } else {
        let newWidth = originalWidth;
        let newHeight = originalHeight;
        if (mustBeEven) {
          newWidth = originalWidth % 2 === 0 ? originalWidth : originalWidth - 1;
          newHeight = originalHeight % 2 === 0 ? originalHeight : originalHeight - 1;
        }
        return { 'width': newWidth, 'height': newHeight };
      }
    }

    // Calcula el factor de escala
    let scale = Math.min(maxSize / originalWidth, maxSize / originalHeight);
    let newWidth = Math.round(originalWidth * scale);
    let newHeight = Math.round(originalHeight * scale);

    if (mustBeEven) {
      // Asegúrate de que sean números pares
      newWidth = newWidth % 2 === 0 ? newWidth : newWidth - 1;
      newHeight = newHeight % 2 === 0 ? newHeight : newHeight - 1;
    }

    return { 'width': newWidth, 'height': newHeight };
  }

  async getSupportedAudioBitrates(audioTrack, audio_codec = false) {
    if (!audioTrack) {
      return [];
    }

    const bitratesToTest = [
      32000,
      64000,
      96000,
      128000,
      160000,
      192000,
      256000,
      320000
    ];

    const results = [];

    if (audio_codec === false) {
      audio_codec = audioTrack.codec;
    }

    for (const bitrate of bitratesToTest) {
      const config = {
        codec: audio_codec,
        numberOfChannels: audioTrack.audio.channel_count,
        sampleRate: audioTrack.audio.sample_rate,
        bitrate: bitrate,
        bitratemode: "variable"
      };

      try {
        const support = await AudioEncoder.isConfigSupported(config);
        if (support.supported) {
          results.push(support.config.bitrate);
        }
      } catch (error) {}
    }

    return results;
  }

  getAVCCodec(width, height, bitrate) {
    const bitrateMbps = bitrate / 1000000;
    const resolution = width * height;

    // Mapeo de perfiles a sus identificadores hexadecimales
    const profiles = {
      baseline: '42',   // 66 en decimal
      main: '4D',      // 77 en decimal
      high: '64',      // 100 en decimal
      high10: '64',    // '6E' 110 en decimal (Chrome not support)
      high422: '64',   // '7A' 122 en decimal (Chrome not support)
      high444: '64'    // 'F4' 244 en decimal (Chrome not support)
    };

    // Mapeo de niveles a sus identificadores hexadecimales
    const levels = {
      '3.1': '1F',     // 31 en decimal
      '4.0': '28',     // 40 en decimal
      '4.1': '29',     // 41 en decimal
      '5.0': '32',     // 50 en decimal
      '5.1': '33',     // 51 en decimal
      '5.2': '34'      // 52 en decimal
    };

    // Selección de perfil y nivel basado en resolución y bitrate
    let profile, level;

    if (resolution <= 345600) { // hasta 480p
      if (bitrateMbps <= 2) {
        profile = 'baseline';
        level = '3.1';
      } else if (bitrateMbps <= 4) {
        profile = 'main';
        level = '3.1';
      } else {
        profile = 'high';
        level = '3.1';
      }
    } else if (resolution <= 921600) { // hasta 720p
      if (bitrateMbps <= 4) {
        profile = 'main';
        level = '4.0';
      } else if (bitrateMbps <= 8) {
        profile = 'high';
        level = '4.0';
      } else {
        profile = 'high10';
        level = '4.1';
      }
    } else if (resolution <= 2073600) { // hasta 1080p
      if (bitrateMbps <= 8) {
        profile = 'high';
        level = '4.1';
      } else if (bitrateMbps <= 12) {
        profile = 'high10';
        level = '4.1';
      } else {
        profile = 'high422';
        level = '5.0';
      }
    } else { // 4K y superiores
      if (bitrateMbps <= 15) {
        profile = 'high10';
        level = '5.1';
      } else if (bitrateMbps <= 20) {
        profile = 'high422';
        level = '5.1';
      } else {
        profile = 'high444';
        level = '5.2';
      }
    }

    // Construir el string del codec
    // Formato: avc1.PPLLDD donde:
    // PP = profile_idc en hex
    // LL = constraint_set flags (00 para la mayoría de los casos)
    // DD = level_idc en hex
    return `avc1.${profiles[profile]}00${levels[level]}`;
  }

  async helper_preprocess_video_info_function(a) {
    return {};
  }

  getHVC1Codec(width, height, bitrate) {
    // Convertir bitrate a Mbps si está en bps
    const bitrateMbps = bitrate / 1000000;
    const resolution = width * height;

    // Definir los niveles HEVC y sus límites
    const levels = {
        // nivel: [maxLumaSamples, maxBitrate(Mbps)]
        "L30": [552960, 3],
        "L60": [552960, 6],
        "L63": [983040, 10],
        "L90": [2228224, 20],
        "L93": [2228224, 30],
        "L120": [8912896, 30],
        "L123": [8912896, 40],
        "L150": [35651584, 60],
        "L153": [35651584, 80],
        "L156": [35651584, 120]
    };

    // Determinar el nivel basado en resolución y bitrate
    let level;
    if (resolution <= 518400) { // hasta 720p
        if (bitrateMbps <= 3) level = "L30";
        else level = "L60";
    } 
    else if (resolution <= 2073600) { // hasta 1080p
        if (bitrateMbps <= 10) level = "L63";
        else if (bitrateMbps <= 20) level = "L90";
        else level = "L93";
    }
    else if (resolution <= 8847360) { // hasta 4K
        if (bitrateMbps <= 30) level = "L120";
        else level = "L123";
    }
    else { // 8K
        if (bitrateMbps <= 60) level = "L150";
        else if (bitrateMbps <= 80) level = "L153";
        else level = "L156";
    }

    // Determinar el tier (Main o High)
    // Main = 0, High = 1
    const tier = bitrateMbps > 20 ? 1 : 0;

    // Determinar el profile space y profile idc
    // 1 = profile space por defecto
    // 6 = Main 10 profile (el más común para contenido HDR)
    const profileSpace = 1;
    const profileIdc = 6;

    // B0 = sin restricciones específicas
    const constraints = "B0";

    // Construir el string del codec
    return `hvc1.${profileSpace}.${profileIdc}.${level}.${constraints}`;
  }
}