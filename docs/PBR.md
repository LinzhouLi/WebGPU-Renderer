# Physically Based Shading

## 渲染原理

### 光学现象

在物理世界中，光主要会与三种物质交互，他们产生的光学现象构成了人们眼中观察到的世界。

**粒子**（Particles）主要指气体，分子在其中的位置分布是随机且不相关的。当粒子为大气分子时，光在其中传播会发生瑞利散射（Rayleigh Scattering），而当粒子为固体时，发生的散射叫做丁达尔散射（Tyndall Scattering）。

**介质**（Media）主要匀质（Homogeneous Medium），光在其中传播会发生吸收和散射，吸收会决定介质的颜色，散射会决定介质的浑浊程度。

**表面**（Surfaces）即各种物体表面，光与其交互会发生反射和折射现象。而折射光进入介质中，又会进一步与介质进行交互。

<img src="img/1.jpg" width="70%">

<div style="font-family:仿宋;font-size:15px; text-align:center;">图1  入射光与表面交互图示。</div>

### 光与表面交互

光与非光学平坦表面（Non-Optically-Flat Surfaces）交互时，可以看成光与无数个微小的光学平坦表面交互的集合。物体越粗糙，微小平面越起伏，从而反射光也越模糊。在渲染中，模拟这个物理现象的模型称为微表面模型（Microfacet Theory）。

<img src="img/2.png" width="50%">

<div style="font-family:仿宋;font-size:15px; text-align:center;">图2  上图模型光滑，微表面起伏较小，反射清晰。下图模型粗糙，微表面起伏较大，反射模糊。</div>

以上理论描述了光与表面交互的反射现象，而折射现象与具体的物体类型有关。

在金属（导体，Conductor）中，折射光的能量会立即被自由电子吸收；在非金属（电介质，Dielectric）中，折射与光在介质中的现象相同，会发生散射和吸收。

<img src="img/3.png" width="50%">

<div style="font-family:仿宋;font-size:15px; text-align:center;">图3  入射光在表面发生折射与反射，折射光在介质内部经过散射与吸收后从表面重新出射。</div>

折射光与物体内部介质交互，经过散射和吸收后，重新从表面出射的现象，称为次表面散射（Subsurface Scattering）。漫反射（Diffuse）和次表面散射在微观本质上指的是同一种物理现象。但从宏观上，当次表面散射的出射光位置与入射光位置的距离差相对于像素大小可以忽略时，一般称之为漫反射，或局部次表面散射（Local Subsurface Scattering），反之称之为全局次表面散射（Global Subsurface Scattering）。

本文不考虑光线透射和全局次表面散射，总的来说，我们可以把着色拆分成衡量微表面散射的高光项（Specular term）和衡量局部次表面散射的漫反射项（Diffuse Term）。

## 渲染方程与BRDF

Kajiya给出完整的渲染方程（Rendering Equation）如下：
$$
L_o(\textbf p, \textbf v) = 
L_e(\textbf p, \textbf v) +
\int_{\textbf l \in \Omega} f(\textbf l, \textbf v) L_i(\textbf p, \textbf l)(\textbf n \cdot \textbf l)^+ \, \mathrm d \textbf l
$$
等式左边为表面位置 $$\textbf p$$ 在观察方向 $$\textbf v$$ 的辐亮度（Radiance） 。等式右边第一项为 $$\textbf p$$ 点在 $$\textbf v$$ 方向的自发光辐亮度，第二项为入射辐亮度 $$L_i$$ 反射至 $$\textbf v$$ 方向的辐亮度，对入射方向 $$\textbf l$$ 作半球积分（$$\Omega$$ 为半球面）。

如果我们不考虑自发光，就可以将渲染方程简化为反射率方程（Reflectance Equation）：
$$
L_o(\textbf p, \textbf v) = 
\int_{\textbf l \in \Omega} f(\textbf l, \textbf v) L_i(\textbf p, \textbf l)(\textbf n \cdot \textbf l)^+ \, \mathrm d \textbf l
$$
方程中 $$(\textbf n \cdot \textbf l)^+$$ 为入射方向 $$\textbf l$$ 与表面法向 $$\textbf n$$ 夹角余弦值，它描述了入射角带来的入射辐亮度衰减。可以类比于太阳光直射赤道时，维度越高，地球上单位面积接收到的辐射通量越少。

方程中 $$f(\textbf l, \textbf v)$$ 描述了如何从 $$\textbf l$$ 方向入射辐亮度得到 $$\textbf v$$ 方向出射辐亮度，它叫作双向反射分布函数（Bidirectional Reflectance Distribution Function, BRDF）。在以 $$\textbf p$$ 点为原点的局部坐标系下，$$\textbf l$$ 与 $$\textbf v$$ 分别需要两个参数决定：与法向 $$\textbf n$$ 的夹角 $$\theta$$，与切线 $$\textbf t$$ 的夹角 $$\phi$$。

<img src="img/4.png" width="40%">

<div style="font-family:仿宋;font-size:15px; text-align:center;">图4  局部坐标系下的入射方向与观察方向。</div>

对立体角 $$\textbf l$$ 的半球积分可以具体写成：
$$
\int_{\textbf l \in \Omega} \;\mathrm d \textbf l = 
\int_{\phi=0}^{2\pi} \int_{\theta=0}^{\frac{\pi}{2}} 
\sin \theta \,\mathrm d \theta \,\mathrm d \phi
$$
记 $$\mu_i = \cos \theta_i$$ 与 $$ \mu_o = \cos \theta_o$$，反射率方程可以写作：
$$
L_o(\mu_o, \phi_o) =
\int_{\phi_i=0}^{2\pi} \int_{\mu_i=0}^{1}
f(\mu_i,\phi_i,\mu_o,\phi_o) L(\mu_i,\phi_i)\mu_i 
\,\mathrm d \mu_i \,\mathrm d \phi_i
$$
显然其中的BRDF方程有4个参数，而如果物体材质是各向同性的，那么BRDF与方位角 $$\phi_i$$ ， $$\phi_o$$ 的绝对大小是无关的，仅与它们的相对大小有关，即方位角之差 $$\phi$$。所以各向同性的BRDF仅3个参数，这也是绝大多数物体的属性。

BRDF并不是一个随意的函数，物理规律使得它需要满足两条原则。

第一，赫尔姆霍兹互换原则（Helmholtz Reciprocity），即入射与出射方向互换后，函数值不变，数学公式如下：
$$
f(\textbf l, \textbf v) = f(\textbf v, \textbf l)
$$
第二，能量守恒原则（Conservation of Energy），即出射能量不能大于入射能量。这也是基于物理的着色模型与基于经验的着色模型的主要区别之一。定向半球反射率（Directional-Hemispherical Reflectance）反应了BRDF的能量损失，数学公式如下：
$$
R(\textbf l) = \int_{\textbf v \in \Omega} f(\textbf l, \textbf v) (\textbf n \cdot \textbf v) \,\mathrm d \textbf v
$$
它的含义是在方向 $$\textbf l$$ 入射辐照度为1时，BRDF在各个方向出射辐照度的积分。由于能量守恒，$$R(\textbf l)$$ 函数的值域为 $$[0,1]$$，$$R(\textbf l)=0$$ 表示入射光能量被全部吸收。

## 菲涅尔效应

菲涅尔效应（Fresnel Effect）指的是，光线照射某种材质表面时被反射与折射的比例，随着入射角变化而变化。入射角越大，反射越明显。

<img src="img/5.jpg" width="50%">

<div style="font-family:仿宋;font-size:15px; text-align:center;">图5  菲涅尔效应。直接向下看水面时（垂直入射），被反射的比例小，所以可以直接看到水底；<br>而向远处看水面时（掠射），被反射的比例高，可以看到天空的倒影。</div>

菲涅尔函数 $$F(\theta_i)$$ 定义为入射光被反射的比例，当材质一定时，它仅于入射角有关。当 $$\theta_i=0^{\circ}$$ 时，方程反应了垂直入射光被反射的比例，它是材质的一个属性，记为 $$F_0$$；当 $$\theta_i=90^{\circ}$$ 时， 光线入射任何物质都被完全反射，即 $$F_{90}=1$$。

$$F(\theta_i)$$ 对不同波长的入射光的值是不同的，所以 $$F(\theta_i)$$ 是一个RGB的矢量函数。对于非金属，$$F(\theta_i)$$ 对波长的变化非常不明显，且 $$F_0$$ 值较小，通常在0.06以下；而对于金属，$$F(\theta_i)$$ 对波长的变化非常明显，且 $$F_0$$ 值往往在0.5以上。具体实现上，非金属 $$F_0$$ 保存为一个标量，金属 $$F_0$$ 保存为一个RGB值。

<img src="img/6.png" width="60%">

<div style="font-family:仿宋;font-size:15px; text-align:center;">图6  三种材质在不同入射角对不同波长的菲涅尔值。<br>从左至右分别为玻璃、铜、铝。第一行为不同波长菲涅尔值，第二行为转换为RGB的菲涅尔值。</div>

对于菲涅尔函数，Schlick给出了近似函数：
$$
F(\textbf n, \textbf l) \approx F_0 + (F_{90} - F_0) (1 - (\textbf n \cdot \textbf l)^+)^5
$$
上式也可以写作：
$$
F_c = (1 - (\textbf n \cdot \textbf l)^+)^5 \\
F(\textbf n, \textbf l) \approx F_cF_{90} + (1-F_c)F_0
$$
这样可以将Schlick近似理解为用 $$F_c$$ 插值 $$F_0$$ 与 $$F_{90}$$，其中 $$F_{90}=1$$。

## 微表面理论

### 法向分布函数

### 几何遮蔽

## 

## 参考文献

*Real-Time Rendering*

*James T. Kajiya. 1986. The rendering equation. SIGGRAPH Comput. Graph. 20, 4 (Aug. 1986), 143–150. https://doi.org/10.1145/15886.15902*

*Schlick, C. (1994), An Inexpensive BRDF Model for Physically-based Rendering. Computer Graphics Forum, 13: 233-246. https://doi.org/10.1111/1467-8659.1330233*
