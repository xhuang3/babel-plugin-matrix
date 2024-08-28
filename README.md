### `babel-plugin-matrix`: Automated Event Tracking with Babel

#### Usage:

1. **Installation**:  
   Run the following command to install the plugin:
   ```bash
   npm install --save 
   ```

2. **Configuration**:  
   In the directory where you want to enable event tracking, create a `.babelrc` file and add:
   ```json
   {
     "presets": ["react-native"]
   }
   ```

3. **Custom Settings**:  
   In the root directory of your project, create a `matrixConfig.js` file. This file allows you to add custom code snippets that will be injected at runtime.

4. **Setup `matrixConfig.js`**:  
   Open the `matrixConfig.js` file and add the following code:
   ```javascript
   // Code executed at app startup
   export const onBeforeAppStart = async () => {};

   // Code executed before every message is sent
   export const onBeforeMessageSend = async (action, evid, other) => {};

   // Code executed before every message is appended
   export const onBeforeMessageAppend = async () => {};

   // URL where logs will be sent
   export const endPointUrl = '';
   ```

#### Notes:
- Currently, this plugin does not support `react-native-navigation`.
  
#### How It Works:
1. **App Entry Point Injection**:  
   The plugin identifies the entry point of your app and injects the custom code from `matrixConfig.js` into the global scope during Babel compilation.

2. **Event Tracking Injection**:  
   It automatically tracks events such as `onPress`, `onClick`, `onSelect`, etc., by modifying the relevant code to call the custom global functions.

3. **Lifecycle Method Injection**:  
   The plugin adds custom code into component lifecycle methods like `constructor`, `componentDidMount`, and `componentWillUnmount`, invoking the global functions.

#### Compatibility Warning:
- The plugin might become obsolete in future React Native versions (greater than 0.54) where `componentWillMount` is deprecated.

---

#### 中文版本

### `babel-plugin-matrix`: 基于Babel的自动化埋点

#### 使用方法：

1. **安装**:  
   运行以下命令安装该插件：
   ```bash
   npm install --save 
   ```

2. **配置**:  
   在需要启用埋点的目录下，创建 `.babelrc` 文件，并添加以下内容：
   ```json
   {
     "presets": ["react-native"]
   }
   ```

3. **自定义设置**:  
   在项目的根目录下创建 `matrixConfig.js` 文件，该文件允许您添加将在运行时注入的自定义代码片段。

4. **配置 `matrixConfig.js`**:  
   打开 `matrixConfig.js` 文件并添加以下代码：
   ```javascript
   // 应用启动时执行的代码
   export const onBeforeAppStart = async () => {};

   // 每次消息发送前执行的代码
   export const onBeforeMessageSend = async (action, evid, other) => {};

   // 每次消息追加前执行的代码
   export const onBeforeMessageAppend = async () => {};

   // 日志发送的URL
   export const endPointUrl = '';
   ```

#### 注意事项:
- 目前该插件不支持 `react-native-navigation`。

#### 工作原理：
1. **应用入口点注入**:  
   插件会识别应用的入口文件，并在Babel编译时将 `matrixConfig.js` 中的自定义代码注入到全局作用域。

2. **事件跟踪注入**:  
   它会自动跟踪 `onPress`、`onClick`、`onSelect` 等事件，并修改相关代码以调用全局自定义函数。

3. **生命周期方法注入**:  
   插件会在组件的生命周期方法如 `constructor`、`componentDidMount` 和 `componentWillUnmount` 中添加自定义代码，调用全局函数。

#### 兼容性警告：
- 由于未来版本的React Native（> 0.54）中可能弃用 `componentWillMount`，该插件可能会失效。
