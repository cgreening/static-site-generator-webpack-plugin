var evaluate = require('eval');
var path = require('path');
var Promise = require('bluebird');

function StaticSiteGeneratorWebpackPlugin(renderSourcePath, outputs, locals) {
  this.renderSourcePath = renderSourcePath;
  this.outputs = Array.isArray(outputs) ? outputs : [outputs];
  this.locals = locals;
}

StaticSiteGeneratorWebpackPlugin.prototype.apply = function(compiler) {
  var self = this;

  compiler.plugin('emit', function(compiler, done) {
    var renderPromises;

    try {
      var asset = compiler.assets[self.renderSourcePath];

      if (asset === undefined) {
        throw new Error('Soure file not found: "' + self.renderSourcePath + '"');
      }

      var assets = getAssetsFromCompiler(compiler);

      var source = asset.source();
      var render = evaluate(source, /* filename: */ undefined, /* scope: */ undefined, /* noGlobals: */ true);

      renderPromises = self.outputs.map(function(output) {
        var outputFileName = output.dest;

        var locals = {
          path: output.path,
          assets: assets
        };

        for (var prop in self.locals) {
          if (self.locals.hasOwnProperty(prop)) {
            locals[prop] = self.locals[prop];
          }
        }

        return Promise
          .fromNode(render.bind(null, locals))
          .then(function(result) {
            compiler.assets[outputFileName] = createAssetFromContents(result);
          }, function(error) {
            compiler.errors.push(error);
          });
      });

      Promise.all(renderPromises).nodeify(done);
    } catch (err) {
      done(err);
    }
  });
};

// Shamelessly stolen from html-webpack-plugin - Thanks @ampedandwired :)
var getAssetsFromCompiler = function(compiler) {
  var assets = {};
  var webpackStatsJson = compiler.getStats().toJson();
  for (var chunk in webpackStatsJson.assetsByChunkName) {
    var chunkValue = webpackStatsJson.assetsByChunkName[chunk];

    // Webpack outputs an array for each chunk when using sourcemaps
    if (chunkValue instanceof Array) {
      // Is the main bundle always the first element?
      chunkValue = chunkValue[0];
    }

    if (compiler.options.output.publicPath) {
      chunkValue = compiler.options.output.publicPath + chunkValue;
    }
    assets[chunk] = chunkValue;
  }

  return assets;
};

var createAssetFromContents = function(contents) {
  return {
    source: function() {
      return contents;
    },
    size: function() {
      return contents.length;
    }
  };
};

module.exports = StaticSiteGeneratorWebpackPlugin;
