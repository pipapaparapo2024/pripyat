const path=require('path');
module.exports={
    mode:'production',devtool:false,entry:'./src/telegram-entry.js',
    output:{path:path.resolve(__dirname,'telegram-build/libs'),filename:'index.js',chunkFilename:'[id].[contenthash:12].telegram.js',clean:true},
};
