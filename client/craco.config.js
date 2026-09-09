const path = require('path');

module.exports = {
  devServer: {
    allowedHosts: 'all',
  },
  webpack: {
    configure: (webpackConfig) => {
      // Ajouter une règle pour résoudre React depuis node_modules du client
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
        react: path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      };

      // Permettre les imports depuis node_modules pour les alias
      const scopePluginIndex = webpackConfig.resolve.plugins.findIndex(
        ({ constructor }) => constructor && constructor.name === 'ModuleScopePlugin'
      );
      if (scopePluginIndex !== -1) {
        webpackConfig.resolve.plugins.splice(scopePluginIndex, 1);
      }

      return webpackConfig;
    },
  },
};
