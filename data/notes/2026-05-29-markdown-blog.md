# Java 中 Exception 和 Error 有什么区别？

#### 1. 核心概念

- **Error（错误）** ：是程序**无法处理**的严重问题，通常与硬件、运行环境或 JVM 底层资源相关，不建议、也无法通过代码直接恢复。
- **Exception（异常）** ：是程序**可以处理**的非正常情况，通常由业务逻辑、输入数据或外部资源问题引起，可以通过代码捕获并进行补救。

#### 2. 核心原理/技术细节

我们可以从以下几个维度来系统梳理它们的区别：

| **维度** | **Error (错误)**                                         | **Exception (异常)**                                                                              |
| -- | ------------------------------------------ | ------------------------------------------------------------------------------- |
| **继承关系** | `Throwable`-\>`Error`                                   | `Throwable`-\>`Exception`                                                                        |
| **本质定义** | 严重的问题，多为系统/环境/JVM 崩溃导致。 | 程序运行中的一般性异常，多为内部逻辑或可预见的问题。                          |
| **可捕获性** | 理论上可 catch，但**绝不建议**捕获，因为无法修复。   | 应当使用`try-catch`显式捕获或通过`throws`声明抛出。                                              |
| **分类情况** | 均为非受检的（Unchecked）。              | 分为**受检异常**（Checked, 编译时强制处理）和**非受检异常**（Unchecked/RuntimeException, 运行时处理）。 |
| **常见代表** | `OutOfMemoryError`(内存溢出)<br /><br />`StackOverflowError`(栈溢出)<br /><br />`NoClassDefFoundError`(类定义未找到) | `NullPointerException`(空指针)<br /><br />`IOException`(IO异常)<br /><br />`ClassNotFoundException`(类未找到)                                            |
| **JVM 行为** | 发生后 JVM 通常会选择**终止线程**甚至关闭进程。      | 发生后如果没有捕获，当前线程终止；如果成功捕获，程序可继续运行。              |

##### 🌟 经典对比：`ClassNotFoundException` vs `NoClassDefFoundError`

- **ClassNotFoundException (异常)** ：当程序尝试使用 `Class.forName()` 等显式动态加载某个类，但类路径中找不到该类时抛出。属于受检异常，可预期且可以通过捕获来处理。
- **NoClassDefFoundError (错误)** ：Java 编译时该类是存在的，但在运行时 JVM 尝试执行相关的类加载和链接时，却发现该类不见了（例如打包时漏掉了部分 jar 包）。这是运行环境不一致导致的严重错误。

#### 3. 高频面试坑点

- **坑点一：把所有不可期的情况都当作 Exception 捕获**

  - *面试官常问*：“如果发生 `OutOfMemoryError`，你能在代码里 `catch(Exception e)` 把它抓到并让程序恢复吗？”
  - *误区*：认为 `catch(Exception e)` 能抓到一切异常。其实 `Exception` 抓不到 `Error`，它们是平级的兄弟关系。如果要抓全部，必须用 `catch(Throwable t)`，但在 `Error` 发生时去捕获它通常是没有意义的，因为此时 JVM 状态已经不健康了。
- **坑点二：受检异常（Checked）与运行时异常（RuntimeException）的分类混淆**

  - *误区*：面试官常会问哪些是受检异常，哪些是运行时异常。记住 `RuntimeException` 及其子类属于非受检异常（如 `NullPointerException`, `IndexOutOfBoundsException`），其余的 `Exception` 子类（如 `IOException`, `SQLException`）都是受检异常。
