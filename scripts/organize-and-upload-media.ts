import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const STAGING_DIR = path.resolve(process.cwd(), 'media-staging');
const PUBLIC_MEDIA_DIR = path.resolve(process.cwd(), 'apps/web/public/media');

const MEDIA_MAPPING = [
  {
    slug: 'bushwhack-storm-anorak',
    sourceDir: 'bushwack anorack',
    images: {
      'hero.jpeg': 'Gemini_Generated_Image_ywjjtywjjtywjjty.jpeg',
      'camo-variation.jpeg': 'Gemini_Generated_Image_72kcj772kcj772kc.jpeg',
      'field-action.jpeg': 'Gemini_Generated_Image_5l0zs15l0zs15l0z.jpeg',
      'workbench-detail.jpeg': 'Gemini_Generated_Image_shvikeshvikeshvi.jpeg',
    },
  },
  {
    slug: 'bramble-buster-technical-guide-pant',
    sourceDir: 'bramble buster',
    images: {
      'hero.jpeg': 'Gemini_Generated_Image_3bkzwv3bkzwv3bkz.jpeg',
      'camo-variation.jpeg': 'Gemini_Generated_Image_xiu1qpxiu1qpxiu1.jpeg',
      'field-action.jpeg': 'Gemini_Generated_Image_ak5w2pak5w2pak5w.jpeg',
      'workbench-detail.jpeg': 'Gemini_Generated_Image_7c6ap17c6ap17c6a.jpeg',
    },
  },
  {
    slug: 'the-cutbank-lumbar-sling-pack',
    sourceDir: 'cutbank lumbar',
    images: {
      'hero.jpeg': 'Gemini_Generated_Image_ejlx6oejlx6oejlx.jpeg',
      'coyote-variation.jpeg': 'Gemini_Generated_Image_yogq6eyogq6eyogq.jpeg',
      'field-action.jpeg': 'Gemini_Generated_Image_htw1bkhtw1bkhtw1.jpeg',
      'workbench-detail.jpeg': 'Gemini_Generated_Image_sex2l3sex2l3sex2.jpeg',
    },
  },
  {
    slug: 'minimalist-bank-chest-rig',
    sourceDir: 'bank chest rig',
    images: {
      'hero.jpeg': 'Gemini_Generated_Image_frafqnfrafqnfraf.jpeg',
      'prototype-variation.jpeg': 'Gemini_Generated_Image_218pv4218pv4218p.jpeg',
      'field-action.jpeg': 'Gemini_Generated_Image_l1y1jyl1y1jyl1y1.jpeg',
      'workbench-detail.jpeg': 'Gemini_Generated_Image_s3oe03s3oe03s3oe.jpeg',
    },
  },
  {
    slug: 'waxed-canvas-cordura-tool-roll',
    sourceDir: 'cordura tool roll',
    images: {
      'hero.jpeg': 'Gemini_Generated_Image_l562fyl562fyl562.jpeg',
      'charcoal-variation.jpeg': 'Gemini_Generated_Image_f5kphpf5kphpf5kp.jpeg',
      'field-action.jpeg': 'Gemini_Generated_Image_wmems9wmems9wmem.jpeg',
      'workbench-detail.jpeg': 'Gemini_Generated_Image_upx2vrupx2vrupx2.jpeg',
    },
  },
  {
    slug: 'the-bankbeaters-5-panel-guide-cap',
    sourceDir: 'panel guide cap',
    images: {
      'hero.jpeg': 'Gemini_Generated_Image_paph1zpaph1zpaph.jpeg',
      'bark-brown-variation.jpeg': 'Gemini_Generated_Image_l5l1u6l5l1u6l5l1.jpeg',
      'field-action.jpeg': 'Gemini_Generated_Image_tix4a8tix4a8tix4.jpeg',
      'workbench-detail.jpeg': 'Gemini_Generated_Image_x7olmyx7olmyx7ol.jpeg',
    },
  },
];

const BUCKETS = [
  'chrishop-media-preview',
  'chrishop-media-staging',
  'chrishop-media-prod',
];

async function main() {
  console.log('🌲 Organizing authentic BankBeaters product photography...');
  const uploadedFiles: Array<{ slug: string; name: string; destFile: string }> = [];

  for (const item of MEDIA_MAPPING) {
    const targetDir = path.join(PUBLIC_MEDIA_DIR, item.slug);
    fs.mkdirSync(targetDir, { recursive: true });

    for (const [canonicalName, srcFileName] of Object.entries(item.images)) {
      const srcFile = path.join(STAGING_DIR, item.sourceDir, srcFileName);
      const destFile = path.join(targetDir, canonicalName);

      if (!fs.existsSync(srcFile)) {
        throw new Error(`Source file missing: ${srcFile}`);
      }

      fs.copyFileSync(srcFile, destFile);
      const sizeMb = (fs.statSync(destFile).size / (1024 * 1024)).toFixed(2);
      console.log(`  ✔ Copied [${item.slug}] -> ${canonicalName} (${sizeMb} MB)`);

      uploadedFiles.push({
        slug: item.slug,
        name: canonicalName,
        destFile,
      });
    }
  }

  console.log(`\n☁️ Uploading ${uploadedFiles.length} images to Cloudflare R2 buckets: ${BUCKETS.join(', ')}...`);

  for (const bucket of BUCKETS) {
    console.log(`\n🚀 Uploading to bucket: ${bucket}...`);
    for (const file of uploadedFiles) {
      const r2Key = `media/${file.slug}/${file.name}`;
      console.log(`  Uploading ${r2Key}...`);
      try {
        execSync(
          `pnpm exec wrangler r2 object put "${bucket}/${r2Key}" --file="${file.destFile}" --content-type="image/jpeg"`,
          { stdio: 'pipe' }
        );
        console.log(`    ✔ Uploaded ${r2Key}`);
      } catch (err: any) {
        console.error(`    ❌ Failed to upload ${r2Key}:`, err.stderr?.toString() || err.message);
        throw err;
      }
    }
  }

  console.log('\n🎉 All 24 photos successfully organized and uploaded to Cloudflare R2 and public/media!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
