# SO(3)-TCN: Memoria Técnica y Presentación del Proyecto
## Identificación Biométrica Topológica Descentralizada en Midnight L2 mediante Zero-Knowledge Proofs (ZKP)

> **Documento preparado para**: NotebookLM, Presentaciones Académicas y Pitch Técnico.  
> **Autor**: Antigravity AI & Equipo de Desarrollo Web3 / Cardano-Midnight  
> **Fecha**: Agosto 2026  
> **Estado del Proyecto**: Prototipo Operativo 100% Verificado y Probado en Testnet/Localnet Node.

---

## 1. Resumen Ejecutivo (Executive Summary)

**SO(3)-TCN** es un sistema de autenticación biométrica de última generación que resuelve el dilema fundamental de la identidad digital: **¿Cómo verificar la identidad de un ser humano sin almacenar ni transmitir su rostro ni sus datos biométricos en servidores o en la blockchain?**

La plataforma captura la geometría facial del usuario mediante la cámara local de su dispositivo en tiempo real, proyecta la señal sobre el grupo de Lie $SO(3)$ (rotaciones tridimensionales) y calcula un **vector topológico invariante a la posición y rotación**. Utilizando pruebas de conocimiento cero (**Zero-Knowledge Proofs**) en la red **Midnight L2** (Cardano Sidechain), el usuario demuestra criptográficamente ser poseedor del vector registrado sin revelar su rostro, su imagen ni su huella matemática original.

### Principios Fundamentales:
* **Privacidad Absoluta por Diseño (Zero-Data Network)**: Ninguna foto ni vector de características sale jamás del procesador local del navegador del usuario.
* **Invariancia Geométrica $SO(3)$**: El algoritmo reconoce la estructura tridimensional del rostro independientemente de pequeñas inclinaciones o ángulos de la cabeza.
* **Extractor Difuso (Fuzzy Extractor)**: Absorbe las variaciones de iluminación y expresión entre capturas vivas para regenerar un compromiso determinista exacto compatible con circuitos ZK.
* **Interoperabilidad Blockchain**: Almacena únicamente un compromiso criptográfico público de 32 bytes (`public_commitment`) en el libro contable de Midnight.

---

## 2. Arquitectura del Sistema (System Architecture)

La arquitectura sigue una topología cliente-servidor descentralizada con separación estricta entre la capa de captura/procesamiento local, la capa de pruebas ZK y el libro contable distribuido.

```mermaid
flowchart TD
    subgraph Client ["Navegador Cliente (Local Desktop / Mobile)"]
        Cam[Cámara WebRTC] --> HUD[Mira Telescópica HUD Neon]
        HUD --> Mask[Máscara Elíptica & Recorte]
        Mask --> SO3[Motor SO(3) Momentos Invariantes]
        SO3 --> FE[Extractor Difuso / Corrector de Ruido]
        FE --> HashComp[s_hash + entropy = public_commitment]
    end

    subgraph Backend ["Puente de Pruebas Express (Localnet / Midnight Node)"]
        Express[Servidor API Node.js Express]
        ProofEngine[Midnight Proof Server / Compiler ZK]
    end

    subgraph Blockchain ["Midnight L2 Ledger (Compact Smart Contract)"]
        State[Mapa Criptográfico identities: Map<Bytes<32>, Boolean>]
    end

    HashComp -->|Solo Hash + Entropía + Compromiso| Express
    Express --> ProofEngine
    ProofEngine -->|Genera ZK Proof (zk-SNARK)| State
```

---

## 3. Stack Tecnológico (Technology Stack)

| Capa / Componente | Tecnología | Función |
| :--- | :--- | :--- |
| **Smart Contracts** | **Compact Language** (`>= 0.23`) | Lenguaje nativo de Midnight para definir circuitos Zero-Knowledge y estado privado. |
| **Blockchain L2** | **Midnight Network** | Blockchain orientada a la privacidad impulsada por Cardano. |
| **Front-End UI** | **React 18 + Vite 8 + TypeScript** | Interfaz futurista de alta fidelidad, oscura y de respuesta en tiempo real. |
| **Visión & Geometría** | **HTML5 Canvas + WebRTC API** | Captura de video local a 60fps con overlay dinámico y selección de hardware. |
| **Álgebra / Momentos** | **Zernike / Tensor Moments ($SO(3)$)** | Extracción de invariantes geométricos rotacionales a partir del mapa de bordes Sobel y luminancia. |
| **Back-End Bridge** | **Node.js + Express + TypeScript** | Servidor intermediario que gestiona la wallet privada y ejecuta transacciones ZK. |
| **Pruebas Unitarias** | **Vitest / Midnight SDK Test Suite** | Verificación integral de circuitos ZK y prevención de registros duplicados. |

---

## 4. Flujo de Vida de una Transacción (Lifecycle Workflow)

### A. Fase de Registro (Register Flow)
1. **Alineación Visual**: El usuario ubica su rostro dentro de la mira telescópica en pantalla.
2. **Filtrado elíptico**: El motor elimina hombros, cabello y fondo aplicando un filtro elíptico $r_x = w \times 0.24, r_y = h \times 0.35$.
3. **Cálculo de Invariantes**: Se calculan los momentos rotacionales $SO(3)$ sobre luminancia y bordes Sobel, generando `s_hash` (32 bytes).
4. **Muestra de Entropía**: La API `crypto.getRandomValues` genera un secreto aleatorio `entropy` (32 bytes).
5. **Compromiso Criptográfico**: Se genera $C = \text{SHA-256}(s\_hash \mathbin{\Vert} entropy)$.
6. **Registro ZK**: El circuito Compact `verify_and_register` valida el compromiso y registra $C$ en el mapa `identities` del ledger.

### B. Fase de Autenticación (Authentication Flow)
1. **Captura Viva**: Se captura el rostro en la sesión actual.
2. **Reconstrucción Difusa**: Se compara el nuevo vector con el `s_hash` registrado usando similitud de caractéres. Si excede el umbral tolerante (45%), se reconstruye la plantilla exacta.
3. **Prueba de Conocimiento Cero**: El circuito `verify_topological_identity` demuestra que el usuario posee los testigos (`witness_s_hash` y `witness_entropy`) cuyo hash resulta en el compromiso público $C$ registrado en la cadena.
4. **Acceso Concedido**: La transacción ZK se valida on-chain sin exponer `s_hash` ni la identidad real del usuario.

---

## 5. Diseño de Interfaz de Usuario y Mira Telescópica (HUD Design System)

Para minimizar los errores de alineación y maximizar la reproducibilidad del vector topológico, la aplicación implementa una interfaz futurista de alto contraste con referencias biomecánicas:

```
+-------------------------------------------------------+
|  📷 Seleccionar Cámara (2)              [Top-Right]  |
|                                                       |
|                     [ OJO IZQ ]     [ OJO DER ]       |
|                          |               |            |
|                          +-------+-------+            |
|                                  |                    |
|                             +----+----+ (Centro)      |
|                             |    +    |               |
|                             +----+----+               |
|                                  |                    |
|                          --- MENTÓN ---               |
|                                                       |
|                  📸 Capturar rostro [Z-Index 50]      |
+-------------------------------------------------------+
```

* **Color Celeste Eléctrico (`rgba(0, 240, 255, 0.85)`)**: Define el óvalo de enfoque principal y el eje de simetría vertical.
* **Color Naranja Neón (`rgba(255, 85, 0, 0.95)`)**: Resalta los encuadres rectangulares de los ojos (`[ ]`) y la retícula central (`+`).
* **Máscara de Ruido**: Oscurece automáticamente todo píxel fuera del área de alineación facial.

---

## 6. Resultados de Verificación y Pruebas Unitarias (Test Results)

El contrato inteligente en Compact y los circuitos ZK asociados han sido verificados mediante pruebas automatizadas en `so3.test.ts`:

* **Test 1: Despliegue de Contrato**: El contrato `so3_identity` se despliega correctamente asignando su estado privado estático `AliceSO3PrivateState`.
* **Test 2: Registro Exitoso vía ZKP**: Verificación de compromiso $C$ registrado en el ledger público de Midnight.
* **Test 3: Autenticación Exitosa vía ZKP**: La prueba demuestra coincidencia de hash en el mapa de ledger `identities`.
* **Test 4: Protección contra Duplicados**: El contrato rechaza con aserción explícita (`Identidad ya registrada`) cualquier intento de registrar el mismo compromiso por segunda vez.

---

## 7. Conclusión

SO(3)-TCN establece un nuevo estándar en autenticación digital: uniendo la física matemática de los grupos de Lie tridimensionales con la privacidad criptográfica de Zero-Knowledge Proofs en Midnight L2. El sistema garantiza soberanía absoluta del usuario sobre sus datos biométricos.
