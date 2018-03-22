### git地址：git@ofordcode.ofo.so:b2b-frontend/babel-plugin-matrix.git
#### babel-plugin-matrix是一个基于Babel实现的自动化埋点
#### 使用方法：
* npm install --save git+ssh://git@ofordcode.ofo.so:b2b-frontend/babel-plugin-matrix.git
* 在需要使用埋点的目录下，添加 .babelrc
* 在 .babelrc里加上：
```json
{
"presets": ["react-native"]
}
```
* 在根目录上添加 matrixConfig.js，在matrixConfig里可以加上自定义代码
* 打开matrixConfig.js并加上:
```javascript
// This snippet would be run when app starts
export const onBeforeAppStart = async () => {
};

// This snippet would be run every message sends
export const onBeforeMessageSend = async (action, evid, other) => {
};

// This snippet would be run every message appends
export const onBeforeMessageAppend = async () => {};

// when the log should be send to
export const endPointUrl = '';
```

* 目前不支持使用react-native-navigation
* 原理：
    1. 找到App的入口文件，并在babel编译的时候，在入口文件添加代码，把matrixConfig里自定义的代码注入到global里
    2. 找到所有事件的触发入口（onPress/onClick/onSelect etc.），并修改入口代码调用global里注入的自定义代码
    3. 找到所有组件的constructor,componentWillMount,componentWillUnmount,添加自定义代码调用global里注入的代码
* 因为在未来版本RN里（>0.54），componentWillMount或被deprecate，所以可能导致这个库失效。
* 有问题找黄星博: huangxingbo-yx@ofo.com
