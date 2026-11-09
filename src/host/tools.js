/**
 * Model-facing generation tools: the agent can draw, animate and speak through
 * the same OpenRouter key the plugin already resolves.
 *
 * Every tool returns text that names the saved workspace file and its API URL,
 * so the agent can point the user at the result (or open it) without a second
 * round-trip. Video is asynchronous: submit returns a job id, and the status
 * tool downloads the finished MP4 once and returns its path.
 */

const TEXT_OUTPUT = {
  schema: { type: 'string' },
  render: (_args, value) => [{ type: 'text', text: String(value) }],
}

function money(value) {
  const number = Number(value)
  return Number.isFinite(number) ? `$${number.toFixed(2)}` : null
}

function describeFiles(files) {
  return (Array.isArray(files) ? files : [])
    .map((file) => `файл: ${file.path} · ${file.url} · ${file.mediaType} · ${file.bytes} байт`)
    .join('\n')
}

/** Resolve the caller's model or fall back to the first model of that kind. */
async function resolveModel(service, kind, requested) {
  const explicit = String(requested || '').trim()
  if (explicit) return explicit
  const data = await service.generationModels({ kind })
  if (!data || data.ok !== true || !Array.isArray(data.models) || data.models.length === 0) {
    throw new Error(`не удалось получить список моделей ${kind}: ${data && data.error ? data.error : 'список пуст'}`)
  }
  return data.models[0].id
}

/** Tool definitions in registration order. */
export function generationToolDefinitions(service) {
  return [
    {
      name: 'openrouter_generate_image',
      description:
        'Generate an image from a text prompt with OpenRouter (Images API). Saves the image file in the '
        + 'plugin’s generated folder and returns its path and URL. Use when the user asks to draw or generate a picture. '
        + 'The generation is billed to the OpenRouter key balance.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Text description of the desired image.' },
          model: { type: 'string', description: 'Image model id, e.g. openai/gpt-image-2.6-sunburst. Omit to use the first discovered model.' },
          aspectRatio: { type: 'string', description: 'Aspect ratio such as 16:9 or 1:1.' },
          resolution: { type: 'string', enum: ['1K', '2K', '4K'], description: 'Output resolution preset.' },
          quality: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Rendering quality when the provider supports it.' },
        },
        required: ['prompt'],
        additionalProperties: false,
      },
      output: TEXT_OUTPUT,
      timeoutMs: 180_000,
      async execute(args) {
        const model = await resolveModel(service, 'image', args.model)
        const result = await service.generateImage({
          model,
          prompt: args.prompt,
          aspectRatio: args.aspectRatio,
          resolution: args.resolution,
          quality: args.quality,
        })
        if (!result.ok) throw new Error(result.error || 'генерация изображения не удалась')
        const cost = money(result.cost)
        return [
          `Изображение готово (${result.model}).`,
          describeFiles(result.files),
          cost ? `Стоимость: ${cost}.` : null,
        ].filter(Boolean).join('\n')
      },
    },
    {
      name: 'openrouter_generate_video',
      description:
        'Submit an asynchronous video generation job to OpenRouter (Video API) and return its job id. '
        + 'Video takes seconds to minutes: call openrouter_video_status with the job id to poll it and get the saved MP4 path. '
        + 'Generation is billed per second of output at the model’s rate.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Text description of the desired video.' },
          model: { type: 'string', description: 'Video model id, e.g. google/gemini-omni-1.2-flash. Omit to use the first discovered model.' },
          duration: { type: 'integer', description: 'Clip length in seconds (model-dependent, usually 1–30).' },
          resolution: { type: 'string', description: 'Output resolution such as 720p or 1080p.' },
          aspectRatio: { type: 'string', description: 'Aspect ratio such as 16:9 or 9:16.' },
          generateAudio: { type: 'boolean', description: 'Ask the model to generate audio with the video when supported.' },
        },
        required: ['prompt'],
        additionalProperties: false,
      },
      output: TEXT_OUTPUT,
      timeoutMs: 120_000,
      async execute(args) {
        const model = await resolveModel(service, 'video', args.model)
        const result = await service.generateVideo({
          model,
          prompt: args.prompt,
          duration: args.duration,
          resolution: args.resolution,
          aspectRatio: args.aspectRatio,
          generateAudio: args.generateAudio,
        })
        if (!result.ok) throw new Error(result.error || 'не удалось запустить генерацию видео')
        const estimate = money(result.estimate)
        return [
          `Видео-задача запущена (${result.model}), id: ${result.job.id}, статус: ${result.job.status}.`,
          estimate ? `Оценка стоимости: ${estimate}.` : null,
          `Проверить: openrouter_video_status с id "${result.job.id}".`,
        ].filter(Boolean).join('\n')
      },
    },
    {
      name: 'openrouter_video_status',
      description:
        'Poll one OpenRouter video job. When the job is completed the MP4 is downloaded once into the plugin’s '
        + 'generated folder and the tool returns its path and URL; while it is pending the tool returns the status.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Job id returned by openrouter_generate_video.' },
        },
        required: ['id'],
        additionalProperties: false,
      },
      output: TEXT_OUTPUT,
      timeoutMs: 180_000,
      async execute(args) {
        const id = String(args.id || '').trim()
        if (!id) throw new Error('не передан id видео-задачи')
        const status = await service.videoJob({ id })
        if (!status.ok) throw new Error(status.error || 'не удалось получить статус задачи')
        const job = status.job
        if (job.status !== 'completed') {
          return [`Видео-задача ${id}: статус ${job.status}.`, 'Проверь позже ещё раз.'].join('\n')
        }
        const content = await service.videoContent({ id })
        if (!content.ok) throw new Error(content.error || 'не удалось скачать готовое видео')
        const cost = money(job.cost)
        return [
          `Видео готово (${id}).`,
          describeFiles([content.file]),
          cost ? `Стоимость: ${cost}.` : null,
        ].filter(Boolean).join('\n')
      },
    },
    {
      name: 'openrouter_generate_speech',
      description:
        'Synthesize speech from text with OpenRouter (TTS API). Saves the audio file in the plugin’s generated '
        + 'folder and returns its path and URL. Billed per TTS model pricing.',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'Text to synthesize.' },
          model: { type: 'string', description: 'TTS model id, e.g. mistralai/voxtral-mini-tts-2603. Omit to use the first discovered model.' },
          voice: { type: 'string', description: 'Provider-specific voice id.' },
          format: { type: 'string', enum: ['mp3', 'pcm', 'wav'], description: 'Audio container format.' },
          speed: { type: 'number', description: 'Playback speed multiplier when the model supports it.' },
        },
        required: ['input'],
        additionalProperties: false,
      },
      output: TEXT_OUTPUT,
      timeoutMs: 120_000,
      async execute(args) {
        const model = await resolveModel(service, 'speech', args.model)
        const result = await service.synthesizeSpeech({
          model,
          input: args.input,
          voice: args.voice,
          format: args.format,
          speed: args.speed,
        })
        if (!result.ok) throw new Error(result.error || 'не удалось синтезировать речь')
        return [
          `Аудио готово (${result.model}).`,
          describeFiles([result.file]),
        ].filter(Boolean).join('\n')
      },
    },
  ]
}

/**
 * Register the generation tools on a context that exposes `tools`. Returns a
 * disposer; a context without tools (or a deployment that disabled tools) is a
 * silent no-op so the plugin stays universal.
 */
export function registerGenerationTools(ctx, service) {
  if (!ctx || !ctx.tools || typeof ctx.tools.register !== 'function') return () => {}
  if (!service || service.toolsEnabled === false) return () => {}
  const disposers = []
  for (const definition of generationToolDefinitions(service)) {
    disposers.push(ctx.tools.register(definition))
  }
  return () => {
    for (const dispose of disposers) {
      try {
        dispose?.()
      } catch {
        /* unregistering must never break shutdown */
      }
    }
  }
}
