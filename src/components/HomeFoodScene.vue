<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const sceneElement = ref(null)
const canvas = ref(null)
const ready = ref(false)
const photos = ['salad', 'meal', 'buffet']
const resources = new Set()
let renderer, resizeObserver, visibilityObserver, motionPreference
let updateMotion = () => {}
let disposed = false
let visible = true
const pointer = { x: 0, y: 0 }

function moveScene(event) {
  if (event.pointerType !== 'mouse' || motionPreference?.matches) return
  const bounds = sceneElement.value.getBoundingClientRect()
  pointer.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
  pointer.y = -((event.clientY - bounds.top) / bounds.height - 0.5) * 2
}

function resetPointer() {
  pointer.x = 0
  pointer.y = 0
}

function disposeScene() {
  renderer?.setAnimationLoop(null)
  resizeObserver?.disconnect()
  visibilityObserver?.disconnect()
  motionPreference?.removeEventListener('change', updateMotion)
  document.removeEventListener('visibilitychange', updateMotion)
  for (const resource of resources) resource.dispose()
  resources.clear()
  renderer?.dispose()
  renderer?.forceContextLoss()
  renderer = null
}

function showFallback() {
  ready.value = false
  disposeScene()
}

onBeforeUnmount(() => {
  disposed = true
  disposeScene()
})

onMounted(async () => {
  try {
    // Load the renderer only on Home, after the page has mounted.
    const [THREE, { RoundedBoxGeometry }] = await Promise.all([
      import('three'),
      import('three/addons/geometries/RoundedBoxGeometry.js'),
    ])
    if (disposed) return
    renderer = new THREE.WebGLRenderer({ canvas: canvas.value, alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40)
    camera.position.set(0, 6.1, 6.6)
    camera.lookAt(0, 0, 0)
    const world = new THREE.Group()
    world.position.y = 0.3
    scene.add(world)
    scene.add(new THREE.HemisphereLight(0xfffdf9, 0xb7a18b, 1.8))
    const light = new THREE.DirectionalLight(0xfff2de, 2.2)
    light.position.set(-3, 7, 5)
    scene.add(light)

    // Reuse geometry and materials; all objects belong to this one scene.
    function addMesh(geometry, material, parent = world, count = 0) {
      resources.add(geometry)
      resources.add(material)
      const mesh = count
        ? new THREE.InstancedMesh(geometry, material, count)
        : new THREE.Mesh(geometry, material)
      parent.add(mesh)
      return mesh
    }

    // Rotate this short cross-section to form a curved porcelain plate.
    const profile = [
      [0, 0],
      [0.66, 0],
      [0.82, 0.04],
      [0.94, 0.16],
      [1, 0.25],
      [1, 0.29],
      [0.96, 0.31],
      [0.86, 0.19],
      [0.7, 0.12],
      [0, 0.12],
    ]
    const plateGeometry = new THREE.LatheGeometry(
      profile.map(([x, y]) => new THREE.Vector2(x, y)),
      64,
    )
    const porcelain = new THREE.MeshStandardMaterial({
      color: 0xfff9ed,
      roughness: 0.28,
      metalness: 0.05,
    })
    const ringGeometry = new THREE.TorusGeometry(1, 0.003, 6, 96)
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xad4532,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    })
    for (const radius of [2.25, 2.42]) {
      const ring = addMesh(ringGeometry, ringMaterial)
      ring.rotation.x = -Math.PI / 2
      ring.scale.setScalar(radius)
    }

    const tofuGeometry = new RoundedBoxGeometry(0.34, 0.34, 0.34, 2, 0.045)
    const tofuMaterial = new THREE.MeshStandardMaterial({ color: 0xca8539, roughness: 0.65 })
    const tomatoGeometry = new THREE.SphereGeometry(0.18, 20, 12)
    const tomatoMaterial = new THREE.MeshStandardMaterial({ color: 0xd74e30, roughness: 0.35 })
    const leafShape = new THREE.Shape()
    leafShape.moveTo(-0.27, 0)
    leafShape.quadraticCurveTo(0, 0.24, 0.27, 0)
    leafShape.quadraticCurveTo(0, -0.24, -0.27, 0)
    const leafGeometry = new THREE.ShapeGeometry(leafShape, 8)
    const positions = leafGeometry.attributes.position
    for (let i = 0; i < positions.count; i++)
      positions.setZ(i, 0.1 * (1 - Math.abs(positions.getX(i)) / 0.27))
    leafGeometry.computeVertexNormals()
    const leafMaterial = new THREE.MeshStandardMaterial({
      color: 0x648743,
      roughness: 0.75,
      side: THREE.DoubleSide,
    })
    // Draw repeated ingredients in three batches, rather than separate objects.
    const ingredients = [
      {
        geometry: leafGeometry,
        material: leafMaterial,
        count: 26,
        scale: 0.85,
        tilt: -Math.PI / 2,
      },
      { geometry: tofuGeometry, material: tofuMaterial, count: 7, scale: 0.5, tilt: 0.3 },
      { geometry: tomatoGeometry, material: tomatoMaterial, count: 6, scale: 0.6, tilt: 0 },
    ]
    const foodBase = new THREE.SphereGeometry(0.7, 24, 12)
    const foodBaseMaterial = new THREE.MeshStandardMaterial({ color: 0x7c984e, roughness: 1 })
    const transform = new THREE.Object3D()
    const plates = [0, 1, 2].map((index) => {
      const plate = new THREE.Group()
      plate.scale.setScalar(index === 0 ? 1.45 : 0.47)
      addMesh(plateGeometry, porcelain, plate)
      const filling = addMesh(foodBase, foodBaseMaterial, plate)
      filling.scale.y = 0.15
      filling.position.y = 0.2
      ingredients.forEach((food, type) => {
        const pieces = addMesh(food.geometry, food.material, plate, food.count)
        for (let i = 0; i < food.count; i++) {
          const angle = i * 2.4 + type * 1.6 + index * 0.5
          const radius = Math.sqrt((i + 0.5) / food.count) * 0.65
          transform.position.set(
            Math.sin(angle) * radius,
            0.24 + (0.65 - radius) * 0.16 + type * 0.04,
            Math.cos(angle) * radius,
          )
          transform.rotation.set(food.tilt + Math.sin(i) * 0.2, angle, Math.cos(i) * 0.2)
          transform.scale.setScalar(food.scale)
          transform.updateMatrix()
          pieces.setMatrixAt(i, transform.matrix)
        }
        pieces.instanceMatrix.needsUpdate = true
      })
      world.add(plate)
      return plate
    })

    const garnish = [
      { type: 'tofu', x: -2.1, y: 0.65, z: -1.1 },
      { type: 'tofu', x: 2.1, y: 0.8, z: -0.9 },
      { type: 'tofu', x: 0.3, y: 0.6, z: 2.45 },
      { type: 'tomato', x: -2.25, y: 0.4, z: 1.2 },
      { type: 'tomato', x: 1.9, y: 0.55, z: -1.75 },
      { type: 'leaf', x: -1.55, y: 0.75, z: -1.9 },
      { type: 'leaf', x: 2, y: 0.55, z: 1.7 },
    ].map((item) => {
      const geometry =
        item.type === 'tofu' ? tofuGeometry : item.type === 'tomato' ? tomatoGeometry : leafGeometry
      const material =
        item.type === 'tofu' ? tofuMaterial : item.type === 'tomato' ? tomatoMaterial : leafMaterial
      const mesh = addMesh(geometry, material)
      mesh.position.set(item.x, item.y, item.z)
      mesh.rotation.set(-0.5, 0.4, 0.3)
      return { mesh, ...item }
    })

    let elapsed = 0
    let previousTime = 0
    function render(time = 0) {
      if (!renderer || disposed) return
      if (motionPreference.matches || !visible || document.hidden) renderer.setAnimationLoop(null)
      if (previousTime && !motionPreference.matches)
        elapsed += Math.min((time - previousTime) / 1000, 0.05)
      previousTime = time
      const mouseX = motionPreference.matches ? 0 : pointer.x
      const mouseY = motionPreference.matches ? 0 : pointer.y
      world.rotation.x += (mouseY * 0.16 + Math.sin(elapsed / 3) * 0.06 - world.rotation.x) * 0.12
      world.rotation.y += (mouseX * 0.28 - world.rotation.y) * 0.12
      world.rotation.z += (-0.12 - world.rotation.z) * 0.12
      world.position.x += (mouseX * 0.12 - world.position.x) * 0.12
      const angle = (elapsed * Math.PI * 2) / 22 + 0.9
      plates.forEach((plate, index) => {
        if (index)
          plate.position.set(
            Math.sin(angle + (index - 1) * Math.PI) * 2.25,
            0.18,
            Math.cos(angle + (index - 1) * Math.PI) * 2.25,
          )
      })
      garnish.forEach(({ mesh, x, y, z, type }, index) => {
        mesh.position.set(
          x,
          y + (motionPreference.matches ? 0 : Math.sin(elapsed * 0.9 + index) * 0.09),
          z,
        )
        if (type === 'tofu') {
          const phase = angle + Math.PI / 2 + (index % 2) * Math.PI + index * 0.18
          mesh.position.x = Math.sin(phase) * 2.3
          mesh.position.z = Math.cos(phase) * 2.3
          mesh.rotation.set(0.4 + elapsed * 0.18, elapsed * 0.25 + index, 0.3)
        }
      })
      renderer.render(scene, camera)
    }

    motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    updateMotion = () => {
      if (!renderer || disposed) return
      previousTime = 0
      renderer.setAnimationLoop(
        visible && !document.hidden && !motionPreference.matches ? render : null,
      )
      render()
    }
    resizeObserver = new ResizeObserver(() => {
      if (!renderer || disposed) return
      const size = sceneElement.value.clientWidth
      renderer.setSize(size, size, false)
      render()
    })
    resizeObserver.observe(sceneElement.value)
    visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting && entry.intersectionRatio >= 0.15
        updateMotion()
      },
      { threshold: 0.15 },
    )
    visibilityObserver.observe(sceneElement.value)
    motionPreference.addEventListener('change', updateMotion)
    document.addEventListener('visibilitychange', updateMotion)
    renderer.setSize(sceneElement.value.clientWidth, sceneElement.value.clientWidth, false)
    updateMotion()
    ready.value = true
  } catch {
    // The static artwork stays visible if the renderer is unavailable.
    showFallback()
  }
})
</script>

<template>
  <div
    ref="sceneElement"
    class="home-food-scene"
    :data-renderer="ready ? 'webgl' : 'fallback'"
    aria-hidden="true"
    @pointermove="moveScene"
    @pointerleave="resetPointer"
  >
    <div v-if="!ready" class="food-fallback">
      <img
        v-for="(photo, index) in photos"
        :key="photo"
        :src="`/images/${photo}.jpg`"
        alt=""
        :class="`plate-${index}`"
      />
      <i v-for="cube in 3" :key="cube" class="fallback-tofu" :style="{ left: `${cube * 24}%` }"></i>
    </div>
    <canvas ref="canvas" :class="{ ready }" @webglcontextlost.prevent="showFallback"></canvas>
    <svg
      v-for="star in 2"
      :key="star"
      class="scene-star"
      :class="`star-${star}`"
      viewBox="0 0 40 40"
    >
      <path d="M20 0 24 16 40 20 24 24 20 40 16 24 0 20 16 16Z" />
    </svg>
    <i class="accent-dot dot-one"></i><i class="accent-dot dot-two"></i>
  </div>
</template>

<style scoped>
.home-food-scene {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  overflow-anchor: none;
}
.home-food-scene::before {
  content: '';
  position: absolute;
  inset: 2%;
  border-radius: 50%;
  background:
    radial-gradient(#ad45321f 0.8px, transparent 1px) 0 0 / 12px 12px,
    #ad453207;
}
canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  visibility: hidden;
}
canvas.ready {
  visibility: visible;
}
.food-fallback {
  position: absolute;
  inset: 10%;
  border: 1px solid #ad45324d;
  border-radius: 50%;
  transform: perspective(800px) rotateX(42deg) rotateZ(-16deg);
}
.food-fallback img {
  position: absolute;
  object-fit: cover;
  border: 6px solid #fffdf9;
  border-radius: 50%;
  box-shadow: 0 3px 0 #c7baaa;
}
.plate-0 {
  width: 62%;
  height: 62%;
  left: 19%;
  top: 19%;
}
.plate-1,
.plate-2 {
  width: 22%;
  height: 22%;
  left: 39%;
}
.plate-1 {
  top: -11%;
}
.plate-2 {
  bottom: -11%;
}
.fallback-tofu {
  position: absolute;
  top: 5%;
  width: 8%;
  height: 8%;
  border-radius: 20%;
  background: linear-gradient(135deg, #ffe2a3, #d59c53);
  box-shadow: 3px 4px 0 #ac753e;
  transform: rotate(25deg);
}
.scene-star {
  position: absolute;
  width: 22px;
  fill: var(--color-accent);
  pointer-events: none;
}
.star-1 {
  left: 3%;
  top: 30%;
  rotate: 15deg;
}
.star-2 {
  right: 2%;
  bottom: 20%;
  width: 15px;
  rotate: 35deg;
}
.accent-dot {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-accent);
  opacity: 0.45;
  pointer-events: none;
}
.dot-one {
  left: 74%;
  top: 7%;
}
.dot-two {
  left: 35%;
  bottom: 8%;
  width: 4px;
  height: 4px;
}
</style>
