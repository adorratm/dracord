// @ts-check
const path = require('path');
const { rspack } = require('@rspack/core');

/** @type {import('@rspack/core').Configuration} */
module.exports = {
  context: __dirname,
  target: 'node',
  entry: './src/main.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'main.js',
    library: { type: 'commonjs-module' },
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@dracord/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: { syntax: 'typescript', decorators: true },
            transform: {
              legacyDecorator: true,
              decoratorMetadata: true,
            },
            target: 'esnext',
          },
          module: { type: 'commonjs' },
        },
        type: 'javascript/auto',
      },
    ],
  },
  externals: [
    /^@nestjs\/.*/,
    'typeorm',
    'pg',
    'pg-native',
    'bcrypt',
    'web-push',
    '@bull-board/api',
    '@bull-board/express',
    'class-transformer',
    'class-validator',
    'class-transformer/storage',
    'reflect-metadata',
  ],
  plugins: [
    new rspack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    }),
  ],
  devtool: 'source-map',
  optimization: {
    minimize: false,
  },
};
