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
