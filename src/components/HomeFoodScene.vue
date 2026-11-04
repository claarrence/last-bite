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
    const [THREE, { RoundedBoxGeometry }, { RoomEnvironment }] = await Promise.all([
      import('three'),
      import('three/addons/geometries/RoundedBoxGeometry.js'),
      import('three/addons/environments/RoomEnvironment.js'),
    ])
    if (disposed) return
    // Wait for the food photos so the plates never render empty.
    const loader = new THREE.TextureLoader()
    const [saladPhoto, mealPhoto, buffetPhoto] = await Promise.all(
      photos.map((photo) => loader.loadAsync(`/images/${photo}.jpg`)),
    )
    for (const photo of [saladPhoto, mealPhoto, buffetPhoto]) {
      photo.colorSpace = THREE.SRGBColorSpace
      resources.add(photo)
    }
    if (disposed) return disposeScene()

    renderer = new THREE.WebGLRenderer({ canvas: canvas.value, alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    // Neutral tone mapping keeps the photo colours true; anisotropy keeps them sharp at an angle.
    renderer.toneMapping = THREE.NeutralToneMapping
    renderer.shadowMap.enabled = true
    const anisotropy = renderer.capabilities.getMaxAnisotropy()

    const scene = new THREE.Scene()
    // A soft studio environment gives the porcelain and tomatoes believable reflections.
    const pmrem = new THREE.PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    scene.environment = pmrem.fromScene(room, 0.04).texture
    scene.environmentIntensity = 0.8
    resources.add(scene.environment)
    room.dispose()
    pmrem.dispose()

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40)
    camera.position.set(0, 6.1, 6.6)
    camera.lookAt(0, 0, 0)
    const world = new THREE.Group()
    world.position.y = 0.3
    scene.add(world)
    scene.add(new THREE.HemisphereLight(0xfffdf9, 0xb7a18b, 0.5))
    const light = new THREE.DirectionalLight(0xfff2de, 2)
    light.position.set(-3, 7, 5)
    light.castShadow = true
    light.shadow.mapSize.set(1024, 1024)
    light.shadow.radius = 6
    light.shadow.bias = -0.0005
    light.shadow.normalBias = 0.02
    Object.assign(light.shadow.camera, { left: -3.6, right: 3.6, top: 3.6, bottom: -3.6, far: 20 })
    scene.add(light)

    // Reuse geometry and materials; all objects belong to this one scene.
    function addMesh(geometry, material, parent = world, shadows = true, count = 0) {
      resources.add(geometry)
      resources.add(material)
      const mesh = count
        ? new THREE.InstancedMesh(geometry, material, count)
        : new THREE.Mesh(geometry, material)
      mesh.castShadow = mesh.receiveShadow = shadows
      parent.add(mesh)
      return mesh
    }

    // Point a texture at one region of its photo: [centre u, centre v, radius u, radius v].
    function cropPhoto(texture, [u, v, radiusU, radiusV]) {
      texture.repeat.set(radiusU * 2, radiusV * 2)
      texture.offset.set(u - radiusU, v - radiusV)
      texture.anisotropy = anisotropy
      resources.add(texture)
      return texture
    }

    // An unsharp mask: push each pixel away from a blurred copy so food edges stay crisp.
    function sharpen(canvas, amount) {
      const { width, height } = canvas
      const blurred = document.createElement('canvas')
      blurred.width = width
      blurred.height = height
      const blurContext = blurred.getContext('2d')
      blurContext.filter = 'blur(2px)'
      blurContext.drawImage(canvas, 0, 0)
      const soft = blurContext.getImageData(0, 0, width, height).data
      const context = canvas.getContext('2d')
      const image = context.getImageData(0, 0, width, height)
      const pixels = image.data
      for (let i = 0; i < pixels.length; i++)
        if (i % 4 !== 3) pixels[i] += (pixels[i] - soft[i]) * amount
      context.putImageData(image, 0, 0)
    }

    // Copy a dish out of its photo and darken the edge, so the food sits down inside the plate.
    function dishTexture(photo, [u, v, radiusU, radiusV]) {
      const size = 1024
      const dish = document.createElement('canvas')
      dish.width = dish.height = size
      const context = dish.getContext('2d')
      const { width, height } = photo.image
      context.filter = 'contrast(1.08) saturate(1.15)'
      context.drawImage(
        photo.image,
        (u - radiusU) * width,
        (1 - v - radiusV) * height,
        radiusU * 2 * width,
        radiusV * 2 * height,
        0,
        0,
        size,
        size,
      )
      context.filter = 'none'
      sharpen(dish, 0.9)
      const shade = context.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size / 2,
      )
      shade.addColorStop(0.55, 'rgba(45, 28, 18, 0)')
      shade.addColorStop(0.85, 'rgba(45, 28, 18, 0.18)')
      shade.addColorStop(1, 'rgba(45, 28, 18, 0.6)')
      // A blurred grey copy becomes the height map; it fades to zero at the edge so the rim stays down.
      const heightCanvas = document.createElement('canvas')
      heightCanvas.width = heightCanvas.height = 256
      const heightContext = heightCanvas.getContext('2d')
      heightContext.filter = 'grayscale(1) blur(4px)'
      heightContext.drawImage(dish, 0, 0, 256, 256)
      heightContext.filter = 'none'
      const fade = heightContext.createRadialGradient(128, 128, 0, 128, 128, 128)
      fade.addColorStop(0.6, 'rgba(0, 0, 0, 0)')
      fade.addColorStop(0.98, 'rgba(0, 0, 0, 1)')
      heightContext.fillStyle = fade
      heightContext.fillRect(0, 0, 256, 256)

      context.fillStyle = shade
      context.fillRect(0, 0, size, size)
      const map = new THREE.CanvasTexture(dish)
      map.colorSpace = THREE.SRGBColorSpace
      map.anisotropy = anisotropy
      const relief = new THREE.CanvasTexture(heightCanvas)
      resources.add(map)
      resources.add(relief)
      return { map, relief }
    }

    // An invisible floor that only shows the soft shadows under the plates and garnish.
    const ground = addMesh(
      new THREE.CircleGeometry(3.4, 48),
      new THREE.ShadowMaterial({ opacity: 0.16 }),
      world,
      false,
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.01
    ground.receiveShadow = true

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
    const porcelain = new THREE.MeshPhysicalMaterial({
      color: 0xf4eee4,
      roughness: 0.35,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
    })
    const ringGeometry = new THREE.TorusGeometry(1, 0.003, 6, 96)
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xad4532,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    })
    for (const radius of [2.25, 2.42]) {
      const ring = addMesh(ringGeometry, ringMaterial, world, false)
      ring.rotation.x = -Math.PI / 2
      ring.scale.setScalar(radius)
    }

    // Ingredients use textures cut from the same photos: seared tofu and lettuce.
    const tofuGeometry = new RoundedBoxGeometry(0.34, 0.34, 0.34, 3, 0.05)
    const tofuPhoto = cropPhoto(saladPhoto.clone(), [0.522, 0.636, 0.055, 0.055])
    const tofuMaterial = new THREE.MeshStandardMaterial({
      color: 0xfbe6c8,
      map: tofuPhoto,
      bumpMap: tofuPhoto,
      bumpScale: 3,
      roughness: 0.6,
    })
    const tomatoGeometry = new THREE.SphereGeometry(0.18, 32, 20).scale(1, 0.88, 1)
    const tomatoMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xc9321d,
      roughness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    })
    const leafShape = new THREE.Shape()
    leafShape.moveTo(-0.27, 0)
    leafShape.quadraticCurveTo(0, 0.24, 0.27, 0)
    leafShape.quadraticCurveTo(0, -0.24, -0.27, 0)
    const leafGeometry = new THREE.ShapeGeometry(leafShape, 12)
    const leafPositions = leafGeometry.attributes.position
    for (let i = 0; i < leafPositions.count; i++) {
      const x = leafPositions.getX(i)
      leafPositions.setZ(i, 0.1 * (1 - Math.abs(x) / 0.27))
      leafGeometry.attributes.uv.setXY(i, (x + 0.27) / 0.54, leafPositions.getY(i) / 0.24 + 0.5)
    }
    leafGeometry.computeVertexNormals()
    const leafPhoto = cropPhoto(buffetPhoto.clone(), [0.622, 0.833, 0.09, 0.12])
    const leafMaterial = new THREE.MeshStandardMaterial({
      map: leafPhoto,
      roughness: 0.55,
      side: THREE.DoubleSide,
    })

    // The base of each dish is a shallow dome textured with the real photo. A blurred copy
    // of the photo lifts its surface into soft lumps, so it is not a flat disc.
    const foodRadius = 0.82
    const foodHeight = 0.1
    const foodBase = 0.15
    const sphereRadius = (foodRadius ** 2 + foodHeight ** 2) / (2 * foodHeight)
    const foodGeometry = new THREE.SphereGeometry(
      sphereRadius,
      128,
      48,
      0,
      Math.PI * 2,
      0,
      Math.asin(foodRadius / sphereRadius),
    )
    foodGeometry.translate(0, foodBase + foodHeight - sphereRadius, 0)
    // Project the photo straight down so it is not stretched over the dome.
    const foodPositions = foodGeometry.attributes.position
    for (let i = 0; i < foodPositions.count; i++)
      foodGeometry.attributes.uv.setXY(
        i,
        0.5 + foodPositions.getX(i) / (2 * foodRadius),
        0.5 - foodPositions.getZ(i) / (2 * foodRadius),
      )
    const reliefScale = 0.07
    const surfaceY = (radius) =>
      foodBase + foodHeight - sphereRadius + Math.sqrt(sphereRadius ** 2 - radius ** 2)

    // Thin shreds of red cabbage: a flat strip bent into a gentle curve.
    const cabbageGeometry = new THREE.BoxGeometry(0.24, 0.012, 0.035, 10, 1, 1)
    const cabbagePositions = cabbageGeometry.attributes.position
    for (let i = 0; i < cabbagePositions.count; i++)
      cabbagePositions.setZ(i, cabbagePositions.getZ(i) + 1.6 * cabbagePositions.getX(i) ** 2)
    cabbageGeometry.computeVertexNormals()
    const cucumberPhoto = cropPhoto(saladPhoto.clone(), [0.7, 0.356, 0.04, 0.04])

    // 3D ingredients piled on top of the photo so each dish pops out of its plate.
    // tilt: -π/2 lays flat pieces (leaves, onion rings) down on the food.
    const ingredients = [
      {
        geometry: leafGeometry,
        material: leafMaterial,
        count: 22,
        scale: 0.8,
        lift: 0.04,
        tilt: -Math.PI / 2,
      },
      { geometry: tofuGeometry, material: tofuMaterial, count: 9, scale: 0.5, lift: 0.09 },
      { geometry: tomatoGeometry, material: tomatoMaterial, count: 8, scale: 0.55, lift: 0.1 },
      {
        geometry: new THREE.SphereGeometry(0.1, 24, 16).scale(1, 0.8, 1.3),
        material: new THREE.MeshPhysicalMaterial({
          color: 0xfbf8f0,
          roughness: 0.35,
          clearcoat: 0.6,
        }),
        count: 3,
        lift: 0.1,
      },
      {
        geometry: new THREE.SphereGeometry(0.045, 12, 8).scale(1, 0.8, 1.4),
        material: new THREE.MeshStandardMaterial({ color: 0x86b04f, roughness: 0.45 }),
        count: 18,
        lift: 0.07,
      },
      {
        geometry: new THREE.SphereGeometry(0.032, 10, 8),
        material: new THREE.MeshPhysicalMaterial({
          color: 0xf3c442,
          roughness: 0.35,
          clearcoat: 0.5,
        }),
        count: 28,
        lift: 0.07,
      },
      {
        geometry: new RoundedBoxGeometry(0.09, 0.09, 0.09, 2, 0.015),
        material: new THREE.MeshStandardMaterial({ map: cucumberPhoto, roughness: 0.4 }),
        count: 12,
        lift: 0.07,
      },
      {
        geometry: cabbageGeometry,
        material: new THREE.MeshStandardMaterial({ color: 0x6e2a63, roughness: 0.45 }),
        count: 14,
        lift: 0.05,
        tilt: 0,
      },
      {
        geometry: new THREE.TorusGeometry(0.022, 0.008, 6, 16),
        material: new THREE.MeshStandardMaterial({ color: 0x5f9e3a, roughness: 0.5 }),
        count: 18,
        lift: 0.07,
        tilt: -Math.PI / 2,
      },
      {
        geometry: new THREE.SphereGeometry(0.04, 14, 10),
        material: new THREE.MeshStandardMaterial({ color: 0xd9b77a, roughness: 0.7 }),
        count: 10,
        lift: 0.07,
      },
      {
        geometry: new RoundedBoxGeometry(0.1, 0.1, 0.1, 2, 0.02),
        material: new THREE.MeshStandardMaterial({ color: 0xe0782f, roughness: 0.6 }),
        count: 8,
        lift: 0.08,
      },
    ]

    // Each crop is the food inside the bowl or plate in that photo, without its rim.
    const dishes = [
      [saladPhoto, [0.496, 0.494, 0.311, 0.311]],
      [mealPhoto, [0.542, 0.48, 0.167, 0.25]],
      [buffetPhoto, [0.542, 0.513, 0.283, 0.425]],
    ]
    const transform = new THREE.Object3D()
    const plates = dishes.map(([photo, crop], index) => {
      const plate = new THREE.Group()
      plate.scale.setScalar(index === 0 ? 1.45 : 0.5)
      addMesh(plateGeometry, porcelain, plate)
      const { map, relief } = dishTexture(photo, crop)
      addMesh(
        foodGeometry,
        new THREE.MeshStandardMaterial({
          map,
          bumpMap: map,
          bumpScale: 0.6,
          displacementMap: relief,
          displacementScale: reliefScale,
          // A matte surface keeps reflections from greying out the photo.
          roughness: 0.85,
          envMapIntensity: 0.35,
        }),
        plate,
      )
      // Spread each ingredient in a sunflower spiral so the pile looks natural, not gridded.
      ingredients.forEach((food, type) => {
        const pieces = addMesh(food.geometry, food.material, plate, true, food.count)
        for (let i = 0; i < food.count; i++) {
          const angle = i * 2.4 + type * 1.6 + index * 0.5
          const radius = Math.sqrt((i + 0.5) / food.count) * 0.7
          const scale = food.scale ?? 1
          transform.position.set(
            Math.sin(angle) * radius,
            surfaceY(radius) + reliefScale * 0.5 + food.lift * scale,
            Math.cos(angle) * radius,
          )
          const tilt = food.tilt ?? 0.3
          transform.rotation.set(tilt + Math.sin(i) * 0.25, angle, Math.cos(i) * 0.25)
          transform.scale.setScalar(scale)
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
