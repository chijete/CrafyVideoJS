# CrafyVideoJS

**CrafyVideoJS** is a lightweight, hardware-accelerated (GPU) client-side JavaScript library for manipulating, decoding, and encoding MP4 H.264 (AVC) videos directly in the browser. By leveraging the browser's `VideoEncoder` and `VideoDecoder` APIs combined with [mp4box.js](https://github.com/gpac/mp4box.js "mp4box.js"), this library provides fast and efficient video processing without requiring server-side support.

## Features

- ✂️ **Cut videos**: Trim a video to a specific start and end time.
- ⚙️ **Adjust bitrate**: Modify the output video's bitrate.
- 🎥 **Change resolution**: Resize videos while maintaining aspect ratio.
- ℹ️ **Video info extraction**: Retrieve metadata and structural information.
- 🛠️ **Decode and encode**: Perform decoding and encoding of both video and audio tracks.

## Installation

**Requirement:** [mp4box.js](https://github.com/gpac/mp4box.js "mp4box.js") library. 

You can use the file hosted in this repository:

```html
<script src="MP4Box_minified.js"></script>
```

Simply include the library in your project:

```html
<script src="CrafyVideoJS.js"></script>
```

For production environments, use the minified version:

```html
<script src="CrafyVideoJS_minified.js"></script>
```

**Note:** It only works in modern browsers that support [VideoEncoder](https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder/ "VideoEncoder") and [VideoDecoder](https://developer.mozilla.org/en-US/docs/Web/API/VideoDecoder/ "VideoDecoder").

## Live Demo

Check out the [online demo](https://chijete.github.io/CrafyVideoJS/) to see CrafyVideoJS in action!

---

## Documentation

### Example of use

```javascript
var CrafyVideoJS_instance = new CrafyVideoJS();

// Input video must be MP4 H.264 (avc) or MP4 H.265 (hvc)
function onInputFileChange(file) {
	var reader = new FileReader();
	reader.onload = function () {
		CrafyVideoJS_instance.onProgress = function (progressData) {
			console.log("ETA in ms:", progressData['video']['eta']);
		};
		CrafyVideoJS_instance.onResult = function (result) {
			console.log("Link to output video:", URL.createObjectURL(new Blob([result['video_array_buffer']], { type: "video/mp4" })));
		};
		CrafyVideoJS_instance.onError = function (error) {
      console.error("Error:", error);
    };
    // Video compression example, setting max bitrate and max resolution (720p):
		CrafyVideoJS_instance.processVideo({
			file: this.result,
			max_video_bitrate: 1_500_000,
			max_video_resolution: 1280
		});
	};
	reader.readAsArrayBuffer(file);
}
```

### `CrafyVideoJS.onProgress`

This **event** is fired every time a sample is decoded or encoded.

#### Object as parameter

```json
{
  "video": {
    "decoding": {
      "index": 11,
      "count": 1000,
      "percentage": 1,
      "percentage_original": 1.1,
      "eta": 11.5236
    },
    "encoding": {
      "index": 11,
      "count": 1000,
      "percentage": 1,
      "percentage_original": 1.1,
      "eta": 9.5235
    },
    "eta": 12.123456
  },
  "audio": {
    "decoding": {
      "index": 11,
      "count": 1000,
      "percentage": 1,
      "percentage_original": 1.1
    },
    "encoding": {
      "index": 11,
      "count": 1000,
      "percentage": 1,
      "percentage_original": 1.1
    }
  }
}
```

- `"count"` is the total number of samples.
- `"index"` is the index of the last sample processed.
- `"percentage"` is rounded.
- `"eta"` is in miliseconds.

### `CrafyVideoJS.onResult`

This **event** is triggered when the encoding of the output video finishes successfully.

#### Object as parameter

| Key                            | Type                 | Description                            |
|--------------------------------|----------------------|----------------------------------------|
| `video_array_buffer`           | `ArrayBuffer`        | Output video as an `ArrayBuffer`.      |
| `reencoding_time_seconds`      | `float`              | Total processing time in seconds.      |
| `reencoding_video_frames`      | `int`                | Total number of encoded video samples.      |
| `reencoding_video_fps`         | `int`                | Average number of encoded video samples per second.      |
| `reencoding_audio_frames`      | `int`                | Total number of encoded audio samples.      |
| `reencoding_audio_fps`         | `int`                | Average number of encoded audio samples per second.      |

### `CrafyVideoJS.onError`

This **event** is triggered when a fatal error occurs, that is, processing stops completely due to a problem.

#### Parameters

| Parameter         | Type          | Description                           |
|-------------------|---------------|---------------------------------------|
| `error`           | `error`       | Error info                            |

### `CrafyVideoJS.processVideo(options)`

This is the main function to load a video as an `ArrayBuffer`, decode it, apply transformations, and re-encode it.

#### Parameters

| Parameter                         | Type          | Default         | Description                                                                                                       |
|-----------------------------------|---------------|-----------------|-------------------------------------------------------------------------------------------------------------------|
| `file`                            | `ArrayBuffer` | **Required**    | Input video file as an `ArrayBuffer`.                                                                             |
| `start_timestamp`                 | `int`         | `false`         | (Optional) Start trimming the video from this timestamp (in microseconds).                                        |
| `end_timestamp`                   | `int`         | `false`         | (Optional) Trim the video up to this timestamp (in microseconds).                                                 |
| `max_video_bitrate`               | `int`         | `false`         | (Optional) Set the maximum output video bitrate (in bits). If the bitrate of the input video is lower, it will not be modified.                                                        |
| `max_video_resolution`            | `int`         | `false`         | (Optional) Defines the longest edge of the output video in pixels (example: 1920 for 1080p, 1280 for 720p, etc). If the video resolution is lower, it will not be modified.  |
| `queue_max_size`                  | `int`         | `10`            | (Optional) Maximum number of video frames in the processing queue. (A larger number will increase parallel graphics calculations and provide a slight speed improvement, but may cause a bottleneck. A value greater than 15 is not recommended.)                                                       |
| `redimension_system`              | `string`      | `'bitmap'`      | (Optional) Video resizing method: `"webgl"` or `"bitmap"`. (`"bitmap"` is the recommended option). [reference](https://developer.mozilla.org/es/docs/Web/API/Window/createImageBitmap "reference")                |
| `encoder_latencyMode`             | `string`      | `'quality'`     | (Optional) Encoder latency mode: `"quality"` or `"realtime"`. [reference](https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder/configure#latencymode "reference")                                                     |
| `video_info_read_max_time`        | `int`         | `60000`         | (Optional) Maximum time (in milliseconds) to retrieve input video information. If this time limit is exceeded, an error is returned.                                          |
| `redimension_resizeQuality`       | `string`      | `'low'`         | (Optional) Resize quality: `"pixelated"`, `"low"`, `"medium"`, or `"high"`. [reference](https://developer.mozilla.org/es/docs/Web/API/Window/createImageBitmap#options "reference")                                       |
| `max_input_video_size`            | `int`         | `false`         | (Optional) Maximum input video file size in bytes. If the input video exceeds this size, an error is returned.                                                                |
| `max_input_video_samplesCount`    | `int`         | `false`         | (Optional) Maximum number of video samples in the input. If the input video exceeds this number of samples, an error is returned. `Number of samples = Duration in seconds * FPS`                                                           |
| `preprocess_video_info_function`  | `function`    | `false`         | (Optional) Async function to preprocess the input video metadata and dynamically modify the method parameters.           |
| `audio_queue_max_size`  | `int`    | `20`         | (Optional) Maximum number of audio frames in the processing queue. (A larger number will increase parallel graphics calculations and provide a slight speed improvement, but may cause a bottleneck. A value greater than 30 is not recommended.)           |

##### `file`

Allowed formats and codecs:

- MP4
  - Video codec:
    - H.264 (AVC)
    - H.265 (HVC)
  - Audio codec:
    - mp4a
    - Opus

##### `max_video_bitrate`

Fixed maximum.

```javascript
CrafyVideoJS_instance.processVideo({
  max_video_bitrate: 1_500_000 // Fixed int.
});
```

Input video bitrate percentage.

```javascript
CrafyVideoJS_instance.processVideo({
  max_video_bitrate: {
    "type": "percentage_of_original",
    "percentage": 50
  }
});
```

Fixed maximum based on closest resolution to output video resolution.

```javascript
CrafyVideoJS_instance.processVideo({
  max_video_bitrate: {
    "type": "max_by_resolution",
    "data": {
      // (Total resolution = Video width * Video height): Max bitrate
      2073600: 5_000_000, // 1080p, 5mbps
      921600: 1_000_000, // 720p, 1mbps
      307200: 300_000 // 480p, 300kbps
    }
  }
});
```

Percentage of input video bitrate based on closest resolution to output video resolution.

```javascript
CrafyVideoJS_instance.processVideo({
  max_video_bitrate: {
    "type": "percentage_of_original_by_resolution",
    "data": {
      // (Total resolution = Video width * Video height): Percentage of input video bitrate
      2073600: 50, // 1080p, 50%
      921600: 40, // 720p, 40%
      307200: 30 // 480p, 30%
    }
  }
});
```

Percentage of input video bitrate based on closest resolution to output video resolution, combined with a fixed maximum.

```javascript
CrafyVideoJS_instance.processVideo({
  max_video_bitrate: {
    "type": "percentage_and_max_of_original_by_resolution",
    "data": {
      // (Total resolution = Video width * Video height): {percentage, max}
      2073600: {
        "percentage": 50,
        "max": 5_000_000
      },
      921600: {
        "percentage": 40,
        "max": 1_000_000
      },
      307200: {
        "percentage": 30,
        "max": 300_000
      }
    }
  }
});
```

##### `max_video_resolution`

Fixed maximum.

```javascript
CrafyVideoJS_instance.processVideo({
  max_video_resolution: 1920 // 1080p
});
```

Fixed maximum based on closest number of samples to number of samples from the input video.

```javascript
CrafyVideoJS_instance.processVideo({
  max_video_resolution: {
    "type": "by_near_samplesCount",
    "data": {
      // (Number of samples = Video seconds duration * Video FPS): Max resolution
      1200: 1920, // 1080p
      30000: 1280 // 720p
    }
  }
});
```

Fixed maximum based on a maximum number of samples from the input video.

```javascript
CrafyVideoJS_instance.processVideo({
  max_video_resolution: {
    "type": "by_max_samplesCount",
    "data": {
      // (Number of samples = Video seconds duration * Video FPS): Max resolution
      1200: 1920,
      30000: 1280,
      0: 640 // 0 is used when the number of samples in the input video is greater than all the maximums set.
    }
  }
});
```

##### `preprocess_video_info_function`

If set, this function will be called after reading the input video data and will wait for your response to continue.

The function will receive the input video information as a parameter, and must respond with an object that has the same structure as the one used as options in `CrafyVideoJS.processVideo(options)`.

This feature allows fine-grained control over configuration parameters for video processing based on input video information.

Example:

```javascript
CrafyVideoJS_instance.processVideo({
  preprocess_video_info_function: async function (video_info) {
    // Process video_info (mp4box file).
    return {
      redimension_resizeQuality: "high"
    };
  }
});
```

---

## Comparison with FFmpeg WASM

[ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm "ffmpeg.wasm")

| Feature                   | **CrafyVideoJS**                              | **FFmpeg WASM**                             |
|---------------------------|-----------------------------------------------|---------------------------------------------|
| **Performance**           | Very fast (hardware-accelerated via GPU).     | Slow (WebAssembly is CPU-only).             |
| **Browser Compatibility** | Modern browsers supporting `VideoEncoder` and `VideoDecoder` (no Firefox support yet). | Works in most browsers, including Firefox. |
| **Formats/Codecs**        | Video input: MP4 (H.264/AVC), MP4 (H.265/HVC). Video output: MP4 (H.264/AVC) only.                         | Wide range of formats and codecs.           |
| **Use Case**              | Ideal for MP4 H.264-focused applications requiring efficiency. | Flexible for various video processing tasks.|

**Note:** CrafyVideoJS plans to support additional codecs and formats in future releases.

---

## Contributing

We welcome contributions to improve CrafyVideoJS! Here's how you can help:

- **Major Changes**: Fork the repository, create a branch, implement your changes, and submit a pull request.
- **Bug Reports & Feature Requests**: Open an issue with as much detail as possible, including error messages and steps to reproduce (if applicable).
- **Small Fixes**: Feel free to directly submit issues or pull requests for minor changes.

---

## Credits and thanks

- [mp4-h264-re-encode](https://github.com/vjeux/mp4-h264-re-encode)
- [mp4box.js](https://github.com/gpac/mp4box.js)
- [chatgpt](https://chatgpt.com/)
- [claude](https://claude.ai/)

---

## License

CrafyVideoJS is licensed under the MIT License. See the `LICENSE` file for more details.

---

Happy coding! 🚀

Made with 💙 by [Crafy Holding](https://chijete.com/ "Crafy Holding").