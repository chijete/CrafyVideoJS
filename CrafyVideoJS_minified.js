class CrafyVideoJSWebGLImageManager { constructor(e, t) { this.targetWidth = e, this.targetHeight = t, this.initWebGL() } initWebGL() { if (this.canvas = new OffscreenCanvas(this.targetWidth, this.targetHeight), this.gl = this.canvas.getContext("webgl2"), !this.gl) throw new Error("WebGL2 no disponible"); const e = this.compileShader("#version 300 es\n      in vec4 a_position;\n      in vec2 a_texCoord;\n      out vec2 v_texCoord;\n      void main() {\n        gl_Position = a_position;\n        v_texCoord = vec2(a_texCoord.x, 1.0 - a_texCoord.y);\n      }\n    ", this.gl.VERTEX_SHADER), t = this.compileShader("#version 300 es\n      precision highp float;\n      uniform sampler2D u_texture;\n      in vec2 v_texCoord;\n      out vec4 outColor;\n      void main() {\n        outColor = texture(u_texture, v_texCoord);\n      }\n    ", this.gl.FRAGMENT_SHADER); if (this.program = this.gl.createProgram(), this.gl.attachShader(this.program, e), this.gl.attachShader(this.program, t), this.gl.linkProgram(this.program), !this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) throw new Error("Error al linkear programa WebGL"); const i = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), a = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]); this.positionBuffer = this.gl.createBuffer(), this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer), this.gl.bufferData(this.gl.ARRAY_BUFFER, i, this.gl.STATIC_DRAW), this.texCoordBuffer = this.gl.createBuffer(), this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer), this.gl.bufferData(this.gl.ARRAY_BUFFER, a, this.gl.STATIC_DRAW), this.positionLocation = this.gl.getAttribLocation(this.program, "a_position"), this.texCoordLocation = this.gl.getAttribLocation(this.program, "a_texCoord"), this.texture = this.gl.createTexture(), this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture), this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE), this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE), this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR), this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR) } compileShader(e, t) { const i = this.gl.createShader(t); if (this.gl.shaderSource(i, e), this.gl.compileShader(i), !this.gl.getShaderParameter(i, this.gl.COMPILE_STATUS)) throw new Error("Error al compilar shader: " + this.gl.getShaderInfoLog(i)); return i } async resize(e) { const t = this.gl; t.useProgram(this.program), t.viewport(0, 0, this.targetWidth, this.targetHeight), t.bindBuffer(t.ARRAY_BUFFER, this.positionBuffer), t.enableVertexAttribArray(this.positionLocation), t.vertexAttribPointer(this.positionLocation, 2, t.FLOAT, !1, 0, 0), t.bindBuffer(t.ARRAY_BUFFER, this.texCoordBuffer), t.enableVertexAttribArray(this.texCoordLocation), t.vertexAttribPointer(this.texCoordLocation, 2, t.FLOAT, !1, 0, 0), t.bindTexture(t.TEXTURE_2D, this.texture), t.texImage2D(t.TEXTURE_2D, 0, t.RGBA, t.RGBA, t.UNSIGNED_BYTE, e), t.drawArrays(t.TRIANGLE_STRIP, 0, 4), await this.waitForSync(t.fenceSync(t.SYNC_GPU_COMMANDS_COMPLETE, 0)); const i = await createImageBitmap(this.canvas), a = new VideoFrame(i, { timestamp: e.timestamp, duration: e.duration }); return i.close(), a } waitForSync(e) { return new Promise((t => { const i = () => { const a = this.gl.clientWaitSync(e, this.gl.SYNC_FLUSH_COMMANDS_BIT, 0); a === this.gl.TIMEOUT_EXPIRED ? requestAnimationFrame(i) : (this.gl.WAIT_FAILED, t()) }; i() })) } cleanup() { const e = this.gl; e.deleteProgram(this.program), e.deleteBuffer(this.positionBuffer), e.deleteBuffer(this.texCoordBuffer), e.deleteTexture(this.texture) } } class CrafyVideoJS { constructor(e = !1) { this.logs = e, this.resetThisVariables() } resetThisVariables() { this.VIDEO_TIMESCALE = 9e4, this.AUDIO_TIMESCALE = 48e3, this.AUDIO_SAMPLERATE = 48e3, this.AUDIO_SAMPLESIZE = 16, this.AUDIO_CHANNELCOUNT = 2, this.isFirstVideoSample = !0, this.chunkOffset = 40, this.itsOnError = !1 } onProgress(e) { } onError(e) { } onResult(e) { } in_onError(e) { this.itsOnError = !0, this.onError(e) } async processVideo({ file: file, start_timestamp: start_timestamp = !1, end_timestamp: end_timestamp = !1, max_video_bitrate: max_video_bitrate = !1, max_video_resolution: max_video_resolution = !1, queue_max_size: queue_max_size = 10, redimension_system: redimension_system = "bitmap", encoder_latencyMode: encoder_latencyMode = "quality", video_info_read_max_time: video_info_read_max_time = 6e4, redimension_resizeQuality: redimension_resizeQuality = "low", max_input_video_size: max_input_video_size = !1, max_input_video_samplesCount: max_input_video_samplesCount = !1, preprocess_video_info_function: preprocess_video_info_function = !1 } = {}) { this.resetThisVariables(); var savedThis = this; if (!1 === preprocess_video_info_function && (preprocess_video_info_function = savedThis.helper_preprocess_video_info_function), !1 !== end_timestamp && !1 === start_timestamp && (start_timestamp = 0), !1 !== start_timestamp && start_timestamp < 0 && (start_timestamp = 0), !1 !== start_timestamp && !1 !== end_timestamp && end_timestamp <= start_timestamp) throw new Error("end_timestamp must be greater than start_timestamp."); const startNow = performance.now(); let videoDecoder, videoEncoder, audioDecoder, audioEncoder; savedThis.logs && console.log("Started!"); let videoTrack = null, audioTrack = null, decodedVideoFrameIndex = 0, encodedVideoFrameIndex = 0, videoFrameCount = 0, audioFrameCount = 0, decodedAudioFrameIndex = 0, encodedAudioFrameIndex = 0, nextVideoKeyFrameTimestamp = 0, nextAudioKeyFrameTimestamp = 0, sampleVideoDurations = [], sampleAudioDurations = [], videoTrak = null, audioTrak = null, inputVideoBitrate, inputAudioBitrate, inputVideoSamplesNumber, videoResizer, encodedFinishedPromise, encodedFinishedPromise_resolver, mp4boxInputFileReadyPromise_resolver; encodedFinishedPromise = new Promise((e => { encodedFinishedPromise_resolver = e })); let mp4boxInputFileReadyPromise = new Promise((e => { mp4boxInputFileReadyPromise_resolver = e })); const mp4boxOutputFile = savedThis.createMP4File(); savedThis.glob_mp4boxOutputFile = mp4boxOutputFile; const mp4boxInputFile = MP4Box.createFile(); mp4boxInputFile.onError = e => { savedThis.logs && console.error(e) }, mp4boxInputFile.onReady = async info => { if (savedThis.logs && console.log("mp4boxInputFile info", info), videoTrack = info.videoTracks[0], audioTrack = info.audioTracks[0], "mp4a" == audioTrack.codec && (audioTrack.codec = "mp4a.40.2"), videoTrack && !1 !== max_input_video_samplesCount && videoTrack.nb_samples > max_input_video_samplesCount) throw new Error("exceded_max_input_video_samplesCount"); preprocess_video_info_function(info).then((preprocess_video_info_response => { if (Object.entries(preprocess_video_info_response).length > 0) for (const [variableName, variableNewValue] of Object.entries(preprocess_video_info_response)) eval(variableName + " = variableNewValue;"); savedThis.getSupportedAudioBitrates(audioTrack).then((e => { if (savedThis.logs && console.log("queue_max_size", queue_max_size), videoTrack) { savedThis.VIDEO_TIMESCALE = videoTrack.timescale, inputVideoBitrate = videoTrack.bitrate, inputVideoSamplesNumber = videoTrack.nb_samples; var t = !1, i = max_video_resolution; if (!1 !== max_video_resolution && "number" != typeof max_video_resolution) if ("by_near_samplesCount" == max_video_resolution.type) i = Math.round(max_video_resolution.data[Object.keys(max_video_resolution.data)[savedThis.findClosestIndex(Object.keys(max_video_resolution.data), inputVideoSamplesNumber)]]); else if ("by_max_samplesCount" == max_video_resolution.type) { const e = Object.entries(max_video_resolution.data).sort((([e], [t]) => e.localeCompare(t))), t = Object.fromEntries(e); var a = !1; for (const [e, i] of Object.entries(t)) if (0 != e && inputVideoSamplesNumber <= e) { a = i; break } !1 !== a ? i = a : void 0 !== max_video_resolution.data[0] && (i = max_video_resolution.data[0]) } savedThis.logs && console.log("finalMaxVideoResolution", i), !1 !== i && !1 !== (t = savedThis.getDimensionsForResize(videoTrack.track_width, videoTrack.track_height, i, !0, !0)) && ("webgl" == redimension_system && (videoResizer = new CrafyVideoJSWebGLImageManager(t.width, t.height)), savedThis.logs && console.log("Video redimension", t)); var o = !0; let e; videoDecoder = new VideoDecoder({ async output(e) { var i = !0; if (!1 !== start_timestamp && e.timestamp < start_timestamp && (i = !1), i) if (!1 !== t) { var a; if ("webgl" == redimension_system) a = await videoResizer.resize(e); else if ("bitmap" == redimension_system) { const i = await createImageBitmap(e, { resizeWidth: t.width, resizeHeight: t.height, resizeQuality: redimension_resizeQuality }); a = new VideoFrame(i, { timestamp: e.timestamp, duration: e.duration }), i.close() } if (o) o = !1, videoEncoder.encode(a, { keyFrame: !0, timestamp: e.timestamp }); else try { videoEncoder.encode(a, { timestamp: e.timestamp }) } catch (e) { savedThis.logs && console.error(e) } a.close() } else o ? (o = !1, videoEncoder.encode(e, { keyFrame: !0 })) : videoEncoder.encode(e); else videoFrameCount--; try { e.close() } catch (e) { } decodedVideoFrameIndex++, displayProgress() }, error(e) { savedThis.logs && console.error(e) } }); const d = mp4boxInputFile.getTrackById(videoTrack.id); for (const t of d.mdia.minf.stbl.stsd.entries) if (t.avcC || t.hvcC) { const i = new DataStream(void 0, 0, DataStream.BIG_ENDIAN); t.avcC ? t.avcC.write(i) : t.hvcC.write(i), e = new Uint8Array(i.buffer, 8); break } videoDecoder.configure({ codec: videoTrack.codec, codedWidth: videoTrack.track_width, codedHeight: videoTrack.track_height, hardwareAcceleration: "prefer-hardware", description: e }); var r = { width: videoTrack.track_width, height: videoTrack.track_height }; !1 !== t && (r.width = t.width, r.height = t.height); let n = r.width * r.height, c = Math.round(inputVideoBitrate); if (!1 !== max_video_bitrate) if ("number" == typeof max_video_bitrate) c > max_video_bitrate && (c = Math.round(max_video_bitrate)); else if ("percentage_of_original" == max_video_bitrate.type) c = Math.round(c / 100 * max_video_bitrate.percentage); else if ("max_by_resolution" == max_video_bitrate.type) { let e = max_video_bitrate.data[Object.keys(max_video_bitrate.data)[savedThis.findClosestIndex(Object.keys(max_video_bitrate.data), n)]]; c > e && (c = Math.round(e)) } else if ("percentage_of_original_by_resolution" == max_video_bitrate.type) c = Math.round(c / 100 * max_video_bitrate.data[Object.keys(max_video_bitrate.data)[savedThis.findClosestIndex(Object.keys(max_video_bitrate.data), n)]]); else if ("percentage_and_max_of_original_by_resolution" == max_video_bitrate.type) { let e = max_video_bitrate.data[Object.keys(max_video_bitrate.data)[savedThis.findClosestIndex(Object.keys(max_video_bitrate.data), n)]]; c = Math.round(c / 100 * e.percentage), c > e.max && (c = Math.round(e.max)) } savedThis.logs && console.log("newVideoBitrate", c); var s = savedThis.getAVCCodec(r.width, r.height, c); savedThis.logs && console.log("outputVideoCodec", s), videoEncoder = new VideoEncoder({ output(e, t) { let i = new Uint8Array(e.byteLength); e.copyTo(i), null === videoTrak && (videoTrak = savedThis.addTrak(mp4boxOutputFile, { type: "video", width: r.width, height: r.height, avcDecoderConfigRecord: t.decoderConfig.description, codec: s })); const a = sampleVideoDurations.shift() / (1e6 / savedThis.VIDEO_TIMESCALE); savedThis.addSample(mp4boxOutputFile, videoTrak, i, "key" === e.type, a, !0), encodedVideoFrameIndex++, displayProgress(), encodedVideoFrameIndex >= videoFrameCount && encodedFinishedPromise_resolver() }, error(e) { savedThis.logs && console.error(e), savedThis.in_onError(e) } }), videoEncoder.configure({ codec: s, width: r.width, height: r.height, hardwareAcceleration: "prefer-hardware", bitrate: c, bitrateMode: "variable", alpha: "discard", latencyMode: encoder_latencyMode }), mp4boxInputFile.setExtractionOptions(videoTrack.id, null, { nbSamples: 1 / 0 }) } if (audioTrack) { savedThis.AUDIO_TIMESCALE = audioTrack.timescale, savedThis.AUDIO_SAMPLERATE = audioTrack.audio.sample_rate, savedThis.AUDIO_SAMPLESIZE = audioTrack.audio.sample_size, savedThis.AUDIO_CHANNELCOUNT = audioTrack.audio.channel_count, inputAudioBitrate = audioTrack.bitrate; var d = !0; audioDecoder = new AudioDecoder({ async output(e) { if (savedThis.itsOnError) return !1; var t = !0; !1 !== start_timestamp && e.timestamp < start_timestamp && (t = !1), t && (d ? (d = !1, audioEncoder.encode(e, { keyFrame: !0 })) : audioEncoder.encode(e)), e.close(), decodedAudioFrameIndex++, displayProgress() }, error(e) { savedThis.logs && console.error(e) } }); var n = audioTrack.codec, c = n; audioDecoder.configure({ codec: n, numberOfChannels: audioTrack.audio.channel_count, sampleRate: audioTrack.audio.sample_rate }), audioEncoder = new AudioEncoder({ output(e, t) { let i = new Uint8Array(e.byteLength); e.copyTo(i), null === audioTrak && (audioTrak = savedThis.addTrak(mp4boxOutputFile, { type: "audio", codec: c, audioAvgBitrate: l })); const a = sampleAudioDurations.shift() / (1e6 / savedThis.AUDIO_TIMESCALE); savedThis.addSample(mp4boxOutputFile, audioTrak, i, "key" === e.type, a, !videoTrack), encodedAudioFrameIndex++, displayProgress() }, error(e) { savedThis.logs && console.error(e), savedThis.in_onError(e) } }), savedThis.logs && console.log("outputAudioCodec", c), savedThis.logs && console.log("supportedAudioBitrates", e); var l = e[savedThis.findClosestIndex(e, Math.round(audioTrack.bitrate))]; savedThis.logs && console.log("newAudioBitrate", l), audioEncoder.configure({ codec: c, numberOfChannels: audioTrack.audio.channel_count, sampleRate: audioTrack.audio.sample_rate, bitrate: Math.round(l), bitratemode: "variable" }), mp4boxInputFile.setExtractionOptions(audioTrack.id, null, { nbSamples: 1 / 0 }) } mp4boxInputFile.start(), mp4boxInputFileReadyPromise_resolver() })) })) }; var video_eta = { decoding_percentage: 0, decoding_eta: null, encoding_percentage: 0, encoding_eta: null, total_percentage: 0, total_eta: null }, groupsOfVideoChunks; function displayProgress() { var e = {}; if (videoTrack) { let t = Math.round(performance.now()) - Math.round(startNow), i = Math.round(100 * decodedVideoFrameIndex / videoFrameCount); i > video_eta.decoding_percentage && (video_eta.decoding_percentage = i, video_eta.decoding_eta = i >= 100 ? 0 : 100 * t / i - t); let a = Math.round(100 * encodedVideoFrameIndex / videoFrameCount); a > video_eta.encoding_percentage && (video_eta.encoding_percentage = a, video_eta.encoding_eta = a >= 100 ? 0 : 100 * t / a - t); let o = i + a; o > video_eta.total_percentage && (video_eta.total_percentage = o, video_eta.total_eta = o >= 200 ? 0 : 200 * t / o * 1.1 - t), e.video = { decoding: { index: decodedVideoFrameIndex, count: videoFrameCount, percentage: i, percentage_original: 100 * decodedVideoFrameIndex / videoFrameCount, eta: video_eta.decoding_eta }, encoding: { index: encodedVideoFrameIndex, count: videoFrameCount, percentage: a, percentage_original: 100 * encodedVideoFrameIndex / videoFrameCount, eta: video_eta.encoding_eta }, eta: video_eta.total_eta } } audioTrack && (e.audio = { decoding: { index: decodedAudioFrameIndex, count: audioFrameCount, percentage: Math.round(100 * decodedAudioFrameIndex / audioFrameCount), percentage_original: 100 * decodedAudioFrameIndex / audioFrameCount }, encoding: { index: encodedAudioFrameIndex, count: audioFrameCount, percentage: Math.round(100 * encodedAudioFrameIndex / audioFrameCount), percentage_original: 100 * encodedAudioFrameIndex / audioFrameCount } }), savedThis.onProgress(e) } function findNearestKeyframe(e, t, i) { const a = t * i / 1e6; let o = null; for (const t of e) if (t.is_sync) { if (o && !(t.cts <= a)) break; o = t } if (!o) throw new Error("No keyframe found before the specified startTime."); return { keyframe: o, timestamp: 1e6 * o.cts / i } } function filterFramesByRange(e, t, i, a, o) { savedThis.logs && console.log("filterFramesByRange timescale", a); const r = t * a / 1e6; var s = 1 / 0; !1 !== i && (s = i * a / 1e6), savedThis.logs && console.log("cts", r, s), savedThis.logs && console.log("keyframeCts", o); return e.filter((e => e.cts >= o && e.cts <= s)) } async function processGroupsOfVideoChunks() { for (const t of groupsOfVideoChunks) { for (const i of t) { if (savedThis.itsOnError) return !1; for (var e = !0; e;)if (videoDecoder.decodeQueueSize < queue_max_size && videoEncoder.encodeQueueSize < queue_max_size) { try { videoDecoder.decode(new EncodedVideoChunk(i)) } catch (e) { throw savedThis.in_onError(e), new Error("Decode frame error.") } e = !1 } else await sleep(1) } await videoDecoder.flush() } videoDecoder.close() } async function sleep(e) { return new Promise((t => setTimeout(t, e))) } function splitGroupOfVideoChunks(e) { return [e] } async function onComplete() { var e = {}; e.video_array_buffer = mp4boxOutputFile.getBuffer(); const t = (performance.now() - startNow) / 1e3; if (e.reencoding_time_seconds = t, videoTrack && (e.reencoding_video_frames = encodedVideoFrameIndex, e.reencoding_video_fps = Math.round(encodedVideoFrameIndex / t)), audioTrack && (e.reencoding_audio_frames = encodedAudioFrameIndex, e.reencoding_audio_fps = Math.round(encodedAudioFrameIndex / t)), null === videoTrack && null === audioTrack) throw new Error("Can't decodify video."); return e } mp4boxInputFile.onSamples = function (e, t, i) { if (savedThis.itsOnError) return !1; var a = i; if (!1 !== start_timestamp) { const e = findNearestKeyframe(i, start_timestamp, i[0].timescale); a = filterFramesByRange(i, start_timestamp, end_timestamp, i[0].timescale, e.keyframe.cts) } var o = []; for (const t of a) { const i = { type: t.is_sync ? "key" : "delta", timestamp: 1e6 * t.cts / t.timescale, duration: 1e6 * t.duration / t.timescale, data: t.data }; videoTrack && e === videoTrack.id ? (videoFrameCount++, sampleVideoDurations.push(1e6 * t.duration / t.timescale), o.push(i)) : (audioFrameCount++, sampleAudioDurations.push(1e6 * t.duration / t.timescale), audioDecoder.decode(new EncodedAudioChunk(i))) } a = null, o.length > 0 && (groupsOfVideoChunks = splitGroupOfVideoChunks(o), processGroupsOfVideoChunks()) }; try { if (!1 !== max_input_video_size && file.byteLength > max_input_video_size) throw new Error("exceded_max_input_video_size"); file.fileStart = 0, savedThis.logs && console.log("reader.onload"); var readingVideoInfoError = !1, readingMaxTimeTimer = setTimeout((() => { readingVideoInfoError = !0, mp4boxInputFileReadyPromise_resolver() }), video_info_read_max_time); if (mp4boxInputFile.appendBuffer(file), mp4boxInputFile.flush(), await mp4boxInputFileReadyPromise, readingVideoInfoError) throw new Error("exceded_video_info_read_max_time"); clearTimeout(readingMaxTimeTimer), savedThis.logs && console.log("reader.onload 2"), audioTrack && (await audioDecoder.flush(), audioDecoder.close()), savedThis.logs && console.log("reader.onload 3"), videoTrack && (await encodedFinishedPromise, videoEncoder.close()), audioTrack && (await audioEncoder.flush(), audioEncoder.close()), void 0 !== videoResizer && videoResizer.cleanup(), savedThis.logs && console.log("reader.onload 4"); var result = await onComplete(); savedThis.onResult(result) } catch (e) { savedThis.in_onError(e) } } createMP4File() { const e = MP4Box.createFile(), t = (e.add("ftyp").set("major_brand", "mp42").set("minor_version", 0).set("compatible_brands", ["mp42", "isom"]), e.add("free"), e.add("mdat")); e.mdat = t, t.parts = [], t.write = function (e) { this.size = this.parts.map((e => e.byteLength)).reduce(((e, t) => e + t), 0), this.writeHeader(e), this.parts.forEach((t => { e.writeUint8Array(t) })) }; e.add("moov").add("mvhd").set("timescale", 1e3).set("rate", 65536).set("creation_time", 0).set("modification_time", 0).set("duration", 0).set("volume", 1).set("matrix", [65536, 0, 0, 0, 65536, 0, 0, 0, 1073741824]).set("next_track_id", 1); return e } addTrak(e, t) { var i = this; const a = "video" === t.type; if (!a) { e.addTrack({ id: 2, type: "audio", codec: t.codec, language: "und", timescale: this.AUDIO_TIMESCALE, channel_count: this.AUDIO_CHANNELCOUNT, samplesize: this.AUDIO_SAMPLESIZE, samplerate: this.AUDIO_SAMPLERATE, duration: void 0 }), i.audio_track = e.getTrackById(2), i.audio_track.mdia.hdlr.set("handler", "soun").set("name", ""), i.audio_track.mdia.minf.add("smhd").set("flags", 1).set("balance", 0); const a = i.audio_track.mdia.minf.add("dinf"), n = (new BoxParser["url Box"]).set("flags", 1); a.add("dref").addEntry(n); const c = (p = i.audio_track.mdia.minf.add("stbl")).add("stsd").set("version", 0).set("flags", 0), l = t.codec.split(".")[0]; if ("mp4a" === l) { var o = (new BoxParser.mp4aSampleEntry).set("data_reference_index", 1).set("channel_count", i.AUDIO_CHANNELCOUNT).set("samplesize", i.AUDIO_SAMPLESIZE).set("samplerate", i.AUDIO_SAMPLERATE); const e = new BoxParser.esdsBox; o.esds = e, o.esds.version = 0, c.addEntry(o), c.entries[0].type = t.codec } else if ("ac-3" === l || "ec-3" === l) { var r = (new BoxParser.ac3SampleEntry).set("data_reference_index", 1); c.addEntry(r) } else if ("opus" === l) { var s = (new BoxParser.OpusSampleEntry).set("data_reference_index", 1).set("channel_count", i.AUDIO_CHANNELCOUNT).set("samplesize", i.AUDIO_SAMPLESIZE).set("samplerate", i.AUDIO_SAMPLERATE); c.addEntry(s) } else if ("alac" === l) { var d = (new BoxParser.alacSampleEntry).set("data_reference_index", 1); c.addEntry(d) } p.add("stts").set("sample_counts", []).set("sample_deltas", []), p.add("stsc").set("first_chunk", [1]).set("samples_per_chunk", [1]).set("sample_description_index", [1]), p.add("stsz").set("sample_sizes", []), p.add("stco").set("chunk_offsets", []); return e.getTrackById(2) } const n = e.moov, c = n.add("trak"), l = n.mvhd.next_track_id; n.mvhd.next_track_id++; c.add("tkhd").set("flags", BoxParser.TKHD_FLAG_ENABLED | BoxParser.TKHD_FLAG_IN_MOVIE | BoxParser.TKHD_FLAG_IN_PREVIEW).set("creation_time", 0).set("modification_time", 0).set("track_id", l).set("duration", 0).set("layer", 0).set("alternate_group", 0).set("volume", 1).set("matrix", [65536, 0, 0, 0, 65536, 0, 0, 0, 1073741824]).set("width", (t.width || 0) << 16).set("height", (t.height || 0) << 16); const m = c.add("mdia"), u = (m.add("mdhd").set("creation_time", 0).set("modification_time", 0).set("timescale", a ? i.VIDEO_TIMESCALE : i.AUDIO_TIMESCALE).set("duration", 0).set("language", 21956).set("languageString", "und"), m.add("hdlr").set("handler", a ? "vide" : "soun").set("name", ""), m.add("minf")); if (a) { u.add("vmhd").set("graphicsmode", 0).set("opcolor", [0, 0, 0]) } else { u.add("smhd").set("flags", 1).set("balance", 0) } const _ = u.add("dinf"), h = (new BoxParser["url Box"]).set("flags", 1); _.add("dref").addEntry(h); var p = u.add("stbl"); if (a) { const e = new BoxParser.avc1SampleEntry; e.data_reference_index = 1, e.set("width", t.width || 0).set("height", t.height || 0).set("horizresolution", 72 << 16).set("vertresolution", 72 << 16).set("frame_count", 1).set("compressorname", "").set("depth", 24); var g = new BoxParser.avcCBox, v = new MP4BoxStream(t.avcDecoderConfigRecord); g.parse(v), e.addBox(g); p.add("stsd").addEntry(e) } else { const e = t.codec.split("."), a = e[0]; if ("mp4a" === a) { o = (new BoxParser.mp4aSampleEntry).set("data_reference_index", 1).set("channel_count", i.AUDIO_CHANNELCOUNT).set("samplesize", i.AUDIO_SAMPLESIZE).set("samplerate", i.AUDIO_SAMPLERATE << 16); const a = function (e, t, i) { const a = parseInt(e) || 2, o = Math.min(7, Math.max(1, parseInt(i) || 2)), r = { 96e3: 0, 88200: 1, 64e3: 2, 48e3: 3, 44100: 4, 32e3: 5, 24e3: 6, 22050: 7, 16e3: 8, 12e3: 9, 11025: 10, 8e3: 11, 7350: 12 }[t] ?? 4, s = new Uint8Array(2); return s[0] = a << 3 | (14 & r) >> 1, s[1] = (1 & r) << 7 | o << 3, s }(e[2], i.AUDIO_SAMPLERATE, i.AUDIO_CHANNELCOUNT), r = function (e) { const t = Math.ceil(parseFloat(e) || 128e3); return { bufferSizeDB: Math.ceil(1.3 * t / 8), maxBitrate: Math.ceil(1.3 * t), avgBitrate: t } }(t.audioAvgBitrate); console.log(e[2], i.AUDIO_SAMPLERATE, i.AUDIO_CHANNELCOUNT, t.audioAvgBitrate, a, r); var f = new BoxParser.esdsBox; f.version = 0, f.flags = 0, f.ESDescriptor = { tag: 3, length: 0, ESid: 0, flags: 0, dependsOn_ES_ID: 0, URL_length: 0, URLstring: "", OCR_ES_Id: 0, priority: 0 }, f.DecoderConfigDescriptor = { tag: 4, length: 0, objectTypeIndication: 64, streamType: 5, bufferSizeDB: r.bufferSizeDB, maxBitrate: r.maxBitrate, avgBitrate: r.avgBitrate, DecoderSpecificInfo: { tag: 5, length: a.length, data: a } }, f.SLConfigDescriptor = { tag: 6, length: 1, predefined: 2 }, o.addBox(f); p.add("stsd").set("version", 0).set("flags", 0).addEntry(o) } else if ("ac-3" === a || "ec-3" === a) { r = (new BoxParser.ac3SampleEntry).set("data_reference_index", 1); p.add("stsd").addEntry(r) } else if ("opus" === a) { s = (new BoxParser.opusSampleEntry).set("data_reference_index", 1).set("channel_count", i.AUDIO_CHANNELCOUNT).set("samplesize", i.AUDIO_SAMPLESIZE).set("samplerate", i.AUDIO_SAMPLERATE << i.AUDIO_SAMPLESIZE); p.add("stsd").addEntry(s) } else if ("alac" === a) { d = (new BoxParser.alacSampleEntry).set("data_reference_index", 1); p.add("stsd").addEntry(d) } } p.add("stts").set("sample_counts", []).set("sample_deltas", []); if (a) { p.add("stss").set("sample_numbers", []) } p.add("stsc").set("first_chunk", [1]).set("samples_per_chunk", [1]).set("sample_description_index", [1]), p.add("stsz").set("sample_sizes", []), p.add("stco").set("chunk_offsets", []); return c } addSample(e, t, i, a, o, r) { var s = this; const d = "vide" === t.mdia.hdlr.handler; if (s.isFirstVideoSample && d) { s.isFirstVideoSample = !1; const e = 4 + i[0] << 24 + i[1] << 16 + i[2] << 8 + i[3]; i = i.slice(e) } e.mdat.parts.push(i); const n = o / (d ? s.VIDEO_TIMESCALE : s.AUDIO_TIMESCALE) * 1e3; t.samples_duration += n, t.tkhd.duration += n, t.mdia.mdhd.duration += o, r && (e.moov.mvhd.duration += n); const c = t.mdia.minf.stbl; let l = c.stts.sample_deltas.length - 1; c.stts.sample_deltas[l] !== o ? (c.stts.sample_deltas.push(o), c.stts.sample_counts.push(1)) : c.stts.sample_counts[l]++, d && a && c.stss.sample_numbers.push(c.stts.sample_counts.reduce(((e, t) => e + t))), c.stco.chunk_offsets.push(s.chunkOffset), s.chunkOffset += i.byteLength, c.stsz.sample_sizes.push(i.byteLength), c.stsz.sample_count++ } findClosestIndex(e, t) { let i = -1, a = 1 / 0; return e.forEach(((e, o) => { const r = Math.abs(e - t); r < a && (a = r, i = o) })), i } getDimensionsForResize(e, t, i, a = !1, o = !1) { if (e <= i && t <= i) { if (a) return !1; { let i = e, a = t; return o && (i = e % 2 == 0 ? e : e - 1, a = t % 2 == 0 ? t : t - 1), { width: i, height: a } } } let r = Math.min(i / e, i / t), s = Math.round(e * r), d = Math.round(t * r); return o && (s = s % 2 == 0 ? s : s - 1, d = d % 2 == 0 ? d : d - 1), { width: s, height: d } } async getSupportedAudioBitrates(e, t = !1) { const i = [32e3, 64e3, 96e3, 128e3, 16e4, 192e3, 256e3, 32e4], a = []; !1 === t && (t = e.codec); for (const o of i) { const i = { codec: t, numberOfChannels: e.audio.channel_count, sampleRate: e.audio.sample_rate, bitrate: o, bitratemode: "variable" }; try { const e = await AudioEncoder.isConfigSupported(i); e.supported && a.push(e.config.bitrate) } catch (e) { } } return a } getAVCCodec(e, t, i) { const a = i / 1e6, o = e * t; let r, s; return o <= 345600 ? a <= 2 ? (r = "baseline", s = "3.1") : a <= 4 ? (r = "main", s = "3.1") : (r = "high", s = "3.1") : o <= 921600 ? a <= 4 ? (r = "main", s = "4.0") : a <= 8 ? (r = "high", s = "4.0") : (r = "high10", s = "4.1") : o <= 2073600 ? a <= 8 ? (r = "high", s = "4.1") : a <= 12 ? (r = "high10", s = "4.1") : (r = "high422", s = "5.0") : a <= 15 ? (r = "high10", s = "5.1") : a <= 20 ? (r = "high422", s = "5.1") : (r = "high444", s = "5.2"), `avc1.${{ baseline: "42", main: "4D", high: "64", high10: "6E", high422: "7A", high444: "F4" }[r]}00${{ 3.1: "1F", "4.0": "28", 4.1: "29", "5.0": "32", 5.1: "33", 5.2: "34" }[s]}` } async helper_preprocess_video_info_function(e) { return {} } }