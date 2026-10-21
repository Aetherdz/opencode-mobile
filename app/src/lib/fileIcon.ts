import type { IconName } from '@/components/ui/Icon';

const IMAGE_EXTENSIONS = new Set([
  'avif',
  'bmp',
  'gif',
  'heic',
  'heif',
  'jpeg',
  'jpg',
  'png',
  'svg',
  'tif',
  'tiff',
  'webp',
]);

const ARCHIVE_EXTENSIONS = new Set([
  '7z',
  'bz2',
  'dmg',
  'gz',
  'iso',
  'rar',
  'tar',
  'tbz',
  'tgz',
  'xz',
  'zip',
  'zst',
]);

const CODE_EXTENSIONS = new Set([
  'bash',
  'c',
  'cc',
  'clj',
  'cpp',
  'cs',
  'css',
  'dart',
  'ex',
  'exs',
  'go',
  'gradle',
  'h',
  'hpp',
  'hs',
  'html',
  'java',
  'js',
  'json',
  'jsx',
  'kt',
  'kts',
  'lua',
  'md',
  'mdx',
  'mjs',
  'php',
  'pl',
  'py',
  'rb',
  'rs',
  'scala',
  'scss',
  'sh',
  'sql',
  'svelte',
  'swift',
  'toml',
  'ts',
  'tsx',
  'vue',
  'xml',
  'yaml',
  'yml',
  'zsh',
]);

const CODE_FILENAMES = new Set([
  'brewfile',
  'cmakelists.txt',
  'dockerfile',
  'gemfile',
  'justfile',
  'makefile',
  'procfile',
  'rakefile',
  'vagrantfile',
]);

const CODE_MIMES = new Set([
  'application/ecmascript',
  'application/javascript',
  'application/json',
  'application/ld+json',
  'application/typescript',
  'application/x-httpd-php',
  'application/x-javascript',
  'application/x-sh',
  'application/x-typescript',
  'application/x-yaml',
  'application/xml',
  'text/css',
  'text/html',
  'text/javascript',
  'text/markdown',
  'text/typescript',
  'text/x-c',
  'text/x-c++src',
  'text/x-go',
  'text/x-java',
  'text/x-php',
  'text/x-python',
  'text/x-ruby',
  'text/x-rust',
  'text/x-shellscript',
  'text/x-typescript',
  'text/xml',
  'text/yaml',
]);

const ARCHIVE_MIMES = new Set([
  'application/gzip',
  'application/vnd.rar',
  'application/x-7z-compressed',
  'application/x-apple-diskimage',
  'application/x-bzip2',
  'application/x-gzip',
  'application/x-rar-compressed',
  'application/x-tar',
  'application/x-xz',
  'application/x-zip-compressed',
  'application/zip',
  'application/zstd',
]);

export function fileIcon(name: string, mime?: string): IconName {
  const normalizedMime = (mime ?? '').split(';')[0].trim().toLowerCase();
  const lowerName = name.toLowerCase();
  const dot = lowerName.lastIndexOf('.');
  const extension = dot > 0 ? lowerName.slice(dot + 1) : '';

  if (normalizedMime.startsWith('image/') || IMAGE_EXTENSIONS.has(extension)) {
    return 'image-outline';
  }
  if (normalizedMime === 'application/pdf' || extension === 'pdf') {
    return 'document-text-outline';
  }
  if (ARCHIVE_MIMES.has(normalizedMime) || ARCHIVE_EXTENSIONS.has(extension)) {
    return 'archive-outline';
  }
  if (
    CODE_MIMES.has(normalizedMime) ||
    CODE_EXTENSIONS.has(extension) ||
    CODE_FILENAMES.has(lowerName)
  ) {
    return 'code-slash-outline';
  }
  return 'document-outline';
}
