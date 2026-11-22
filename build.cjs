const fs=require('fs');
const path=require('path');
const ts=require('typescript');
const modules=['gabor','game','render','main'];
let code=`/* TypeScriptから生成したブラウザ用パズル実行コード */\n(()=>{\n'use strict';\nconst __modules=Object.create(null),__cache=Object.create(null);\nfunction require(id){const name=id.replace(/^\\.\\//,'').replace(/\\.js$/,'');if(!__modules[name])throw Error('モジュールが見つかりません: '+id);if(__cache[name])return __cache[name].exports;const module={exports:{}};__cache[name]=module;__modules[name](require,module,module.exports);return module.exports;}\n`;
for(const name of modules){
  const source=fs.readFileSync(path.join(__dirname,'src',name+'.ts'),'utf8');
  const transpiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,removeComments:false}}).outputText;
  code+=`__modules[${JSON.stringify(name)}]=function(require,module,exports){\n${transpiled}\n};\n`;
}
code+=`require('./main.js');\n})();\n`;
fs.writeFileSync(path.join(__dirname,'bundle.js'),code);
let html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
html=html.replace('<script type="module" src="./dist/main.js"></script>','<script>'+code.replaceAll('</script','<\\/script')+'</script>');
fs.writeFileSync(path.join(__dirname,'standalone.html'),html);
console.log('bundle.jsとstandalone.htmlを生成しました（'+code.length+'バイト）');
