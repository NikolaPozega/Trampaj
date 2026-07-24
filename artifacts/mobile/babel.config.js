module.exports = function (api) {
  api.cache(true);

  const classCompatPlugins = [
    ["@babel/plugin-transform-class-properties", { loose: true }],
    ["@babel/plugin-transform-private-methods", { loose: true }],
    ["@babel/plugin-transform-private-property-in-object", { loose: true }],
    ["@babel/plugin-transform-classes", { loose: true }],
  ];

  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: [
      // hermesc does not support async/await natively; Babel must lower them
      // to generator functions before the bundle is handed to hermesc.
      "@babel/plugin-transform-async-to-generator",
    ],
    overrides: [
      {
        test: /\.[cm]?tsx?$/,
        plugins: [
          ["@babel/plugin-transform-typescript", { allowDeclareFields: true }],
          ...classCompatPlugins,
        ],
      },
      {
        test: /\.[cm]?jsx?$/,
        plugins: classCompatPlugins,
      },
    ],
  };
};
