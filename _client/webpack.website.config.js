const path=require('path');
module.exports={mode:'production',devtool:false,entry:'./src/website-entry.js',output:{path:path.resolve(__dirname,'website-build/libs'),filename:'index.js',chunkFilename:'[id].[contenthash:12].website.js',clean:true}};
