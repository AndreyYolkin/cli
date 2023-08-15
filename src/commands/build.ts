import { relative, resolve } from 'pathe'
import { consola } from 'consola'
import type { Nitro } from 'nitropack'
// we are deliberately inlining this code as a backup in case user has `@nuxt/schema<3.7`
import { writeTypes as writeTypesLegacy } from '@nuxt/kit'

import { loadKit } from '../utils/kit'
import { clearBuildDir } from '../utils/fs'
import { overrideEnv } from '../utils/env'
import { showVersions } from '../utils/banner'
import { defineCommand } from 'citty'
import { sharedArgs, legacyRootDirArgs } from './_shared'

export default defineCommand({
  meta: {
    name: 'build',
    description: 'Build nuxt for production deployment',
  },
  args: {
    ...sharedArgs,
    prerender: {
      type: 'boolean',
      description: 'Build nuxt and prerender static routes',
    },
    dotenv: {
      type: 'string',
      description: 'Path to .env file',
    },
    ...legacyRootDirArgs,
  },
  async run(ctx) {
    overrideEnv('production')

    const cwd = resolve(ctx.args.cwd || ctx.args.rootDir || '.')

    showVersions(cwd)

    const {
      loadNuxt,
      buildNuxt,
      useNitro,
      writeTypes = writeTypesLegacy,
    } = await loadKit(cwd)

    const nuxt = await loadNuxt({
      rootDir: cwd,
      dotenv: {
        cwd,
        fileName: ctx.args.dotenv,
      },
      overrides: {
        logLevel: ctx.args.logLevel as 'silent' | 'info' | 'verbose',
        // TODO: remove in 3.8
        _generate: ctx.args.prerender,
        ...(ctx.args.prerender ? { nitro: { static: true } } : {}),
        ...ctx.data?.overrides,
      },
    })

    let nitro: Nitro | undefined
    // In Bridge, if nitro is not enabled, useNitro will throw an error
    try {
      // Use ? for backward compatibility for Nuxt <= RC.10
      nitro = useNitro?.()
    } catch {
      //
    }

    await clearBuildDir(nuxt.options.buildDir)

    await writeTypes(nuxt)

    nuxt.hook('build:error', (err) => {
      consola.error('Nuxt Build Error:', err)
      process.exit(1)
    })

    await buildNuxt(nuxt)

    if (ctx.args.prerender) {
      if (!nuxt.options.ssr) {
        consola.warn(
          'HTML content not prerendered because `ssr: false` was set. You can read more in `https://nuxt.com/docs/getting-started/deployment#static-hosting`.',
        )
      }
      // TODO: revisit later if/when nuxt build --prerender will output hybrid
      const dir = nitro?.options.output.publicDir
      const publicDir = dir ? relative(process.cwd(), dir) : '.output/public'
      consola.success(
        `You can now deploy \`${publicDir}\` to any static hosting!`,
      )
    }
  },
})
