<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const sceneElement = ref(null)
const canvas = ref(null)
const ready = ref(false)
// Photos are only used by the static fallback; the 3D food is modelled, not photographed.
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

// Repeatable pseudo-random numbers, so the food is arranged the same way on every visit.
let seed = 11
function random() {
  seed = (seed * 16807) % 2147483647
  return seed / 2147483647
}

onMounted(async () => {
  try {
    // Load the renderer only on Home, after the page has mounted.
    const [THREE, { RoundedBoxGeometry }, { RoomEnvironment }] = await Promise.all([
      import('three'),
      import('three/addons/geometries/RoundedBoxGeometry.js'),
      import('three/addons/environments/RoomEnvironment.js'),
    ])
    if (disposed) return
    seed = 11

    renderer = new THREE.WebGLRenderer({ canvas: canvas.value, alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.NeutralToneMapping
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    const scene = new THREE.Scene()
    // A soft studio environment gives the porcelain, tomatoes and grapes believable reflections.
    const pmrem = new THREE.PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    scene.environment = pmrem.fromScene(room, 0.04).texture
    scene.environmentIntensity = 0.75
    resources.add(scene.environment)
    room.dispose()
    pmrem.dispose()

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40)
    camera.position.set(0, 5.2, 7)
    camera.lookAt(0, 0.5, 0)
    const world = new THREE.Group()
    scene.add(world)
    scene.add(new THREE.HemisphereLight(0xfffdf9, 0xb7a18b, 0.6))
    const light = new THREE.DirectionalLight(0xfff2de, 2.2)
    light.position.set(-3, 7, 5)
    light.castShadow = true
    light.shadow.mapSize.set(1024, 1024)
    light.shadow.radius = 5
    light.shadow.bias = -0.0005
    light.shadow.normalBias = 0.02
    Object.assign(light.shadow.camera, { left: -3.8, right: 3.8, top: 3.8, bottom: -3.8, far: 20 })
    scene.add(light)
    // A warm light from behind outlines the food so it separates from the background.
    const rimLight = new THREE.DirectionalLight(0xffd9b8, 0.9)
    rimLight.position.set(4, 3, -5)
    scene.add(rimLight)

    // Reuse geometry and materials; all objects belong to this one scene.
    function addMesh(geometry, material, parent = world, shadows = true, count = 0) {
      resources.add(geometry)
      for (const part of [material].flat()) resources.add(part)
      const mesh = count
        ? new THREE.InstancedMesh(geometry, material, count)
        : new THREE.Mesh(geometry, material)
      mesh.castShadow = mesh.receiveShadow = shadows
      parent.add(mesh)
      return mesh
    }

    function canvasTexture(size, draw, colour = true) {
      const surface = document.createElement('canvas')
      surface.width = surface.height = size
      draw(surface.getContext('2d'), size)
      const texture = new THREE.CanvasTexture(surface)
      if (colour) texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
      resources.add(texture)
      return texture
    }

    // Grey speckles used as a bump map: crust on bread, pores on tofu, texture in the greens.
    const speckle = canvasTexture(
      256,
      (context, size) => {
        context.fillStyle = '#808080'
        context.fillRect(0, 0, size, size)
        for (let i = 0; i < 2600; i++) {
          const shade = Math.floor(80 + random() * 100)
          context.fillStyle = `rgb(${shade}, ${shade}, ${shade})`
          context.beginPath()
          context.arc(random() * size, random() * size, 0.6 + random() * 2.4, 0, Math.PI * 2)
          context.fill()
        }
      },
      false,
    )
    speckle.wrapS = speckle.wrapT = THREE.RepeatWrapping

    // Leaf veins: a light midrib with side veins on grey, tinted green per leaf.
    const veins = canvasTexture(256, (context, size) => {
      context.fillStyle = '#d4d4d4'
      context.fillRect(0, 0, size, size)
      context.strokeStyle = '#ffffff'
      context.lineWidth = 6
      context.beginPath()
      context.moveTo(0, size / 2)
      context.lineTo(size, size / 2)
      context.stroke()
      context.lineWidth = 2.5
      for (let x = 20; x < size; x += 26) {
        context.beginPath()
        context.moveTo(x, size / 2)
        context.lineTo(x + 30, 0)
        context.moveTo(x, size / 2)
        context.lineTo(x + 30, size)
        context.stroke()
      }
    })

    // The cut face of an orange slice: rind, pith and ten juicy segments.
    const orangeFace = canvasTexture(256, (context, size) => {
      const centre = size / 2
      context.fillStyle = '#e8781f'
      context.fillRect(0, 0, size, size)
      context.fillStyle = '#fbe6bd'
      context.beginPath()
      context.arc(centre, centre, centre * 0.92, 0, Math.PI * 2)
      context.fill()
      for (let i = 0; i < 10; i++) {
        const start = (i / 10) * Math.PI * 2 + 0.04
        const end = ((i + 1) / 10) * Math.PI * 2 - 0.04
        context.fillStyle = i % 2 ? '#f6a133' : '#f39a2b'
        context.beginPath()
        context.moveTo(centre, centre)
        context.arc(centre, centre, centre * 0.84, start, end)
        context.fill()
      }
      context.fillStyle = '#fde9c4'
      context.beginPath()
      context.arc(centre, centre, centre * 0.08, 0, Math.PI * 2)
      context.fill()
    })

    // An invisible floor that only shows the soft shadows.
    const ground = addMesh(
      new THREE.CircleGeometry(3.8, 48),
      new THREE.ShadowMaterial({ opacity: 0.14 }),
      world,
      false,
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true

    const porcelain = new THREE.MeshPhysicalMaterial({
      color: 0xf6f0e6,
      roughness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
    })
    const accent = new THREE.MeshStandardMaterial({ color: 0xad4532, roughness: 0.4 })
    // Turn a short cross-section [radius, height] into a round dish on a lathe.
    function dishGeometry(profile) {
      return new THREE.LatheGeometry(
        profile.map(([x, y]) => new THREE.Vector2(x, y)),
        72,
      )
    }

    // Shared food shapes.
    const leafGeometry = new THREE.PlaneGeometry(0.6, 1, 18, 6)
    const leafPoints = leafGeometry.attributes.position
    for (let i = 0; i < leafPoints.count; i++) {
      const x = leafPoints.getX(i)
      const across = leafPoints.getY(i)
      // Pointed at both tips, cupped across the middle, ruffled along the edge.
      // max(0, …): rounding can make the sine slightly negative at a tip, and a fractional power of that is NaN.
      const width = 0.22 * Math.max(0, Math.sin(Math.PI * (x / 0.6 + 0.5))) ** 0.7
      const y = across * 2 * width
      const z = 1.8 * y * y - 0.35 * x * x + Math.sin(x * 32) * 0.02 * Math.abs(across) * 2
      leafPoints.setXYZ(i, x, y, z)
    }
    leafGeometry.computeVertexNormals()
    const leafMaterial = new THREE.MeshStandardMaterial({
      map: veins,
      roughness: 0.5,
      side: THREE.DoubleSide,
    })
    const tofuGeometry = new RoundedBoxGeometry(0.22, 0.22, 0.22, 3, 0.045)
    const tofuMaterial = new THREE.MeshStandardMaterial({
      color: 0xe3a65a,
      roughness: 0.65,
      bumpMap: speckle,
      bumpScale: 1.2,
    })
    const tomatoGeometry = new THREE.SphereGeometry(0.1, 32, 20).scale(1, 0.88, 1)
    const tomatoMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xd0331f,
      roughness: 0.25,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
    })
    const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x4d7f2b, roughness: 0.6 })
    const transform = new THREE.Object3D()
    const tint = new THREE.Color()

    // ---------- The main salad bowl ----------
    const bowl = new THREE.Group()
    world.add(bowl)
    addMesh(
      dishGeometry([
        [0, 0],
        [0.5, 0],
        [0.56, 0.04],
        [0.8, 0.2],
        [1, 0.42],
        [1.1, 0.58],
        [1.12, 0.62],
        [1.08, 0.64],
        [0.98, 0.53],
        [0.78, 0.35],
        [0.5, 0.21],
        [0, 0.21],
      ]),
      porcelain,
      bowl,
    )
    const rim = addMesh(new THREE.TorusGeometry(1.105, 0.02, 10, 96), accent, bowl)
    rim.rotation.x = -Math.PI / 2
    rim.position.y = 0.625

    // A mound of greens fills the bowl; everything else is placed on its surface.
    const bedRadius = 0.99
    const bedHeight = 0.2
    const bedBase = 0.5
    const bedSphere = (bedRadius ** 2 + bedHeight ** 2) / (2 * bedHeight)
    const bedGeometry = new THREE.SphereGeometry(
      bedSphere,
      96,
      24,
      0,
      Math.PI * 2,
      0,
      Math.asin(bedRadius / bedSphere),
    ).translate(0, bedBase + bedHeight - bedSphere, 0)
    addMesh(
      bedGeometry,
      new THREE.MeshStandardMaterial({
        color: 0x3f6b2a,
        roughness: 0.85,
        bumpMap: speckle,
        bumpScale: 2,
      }),
      bowl,
    )
    const bedSurface = (radius) =>
      bedBase + bedHeight - bedSphere + Math.sqrt(bedSphere ** 2 - radius ** 2)

    // Scatter `count` copies of a shape over part of the bowl, between two angles and radii.
    function scatter(geometry, material, count, options) {
      const { from = 0, to = Math.PI * 2, inner = 0.1, outer = 0.8, lift, tilt = 0.3 } = options
      const { size = [1, 1], colours } = options
      const pieces = addMesh(geometry, material, bowl, true, count)
      for (let i = 0; i < count; i++) {
        const angle = from + random() * (to - from)
        const radius = inner + Math.sqrt(random()) * (outer - inner)
        const scale = size[0] + random() * (size[1] - size[0])
        transform.position.set(
          Math.cos(angle) * radius,
          bedSurface(radius) + lift * scale,
          Math.sin(angle) * radius,
        )
        transform.rotation.set(
          tilt + (random() - 0.5) * 0.5,
          random() * Math.PI * 2,
          (random() - 0.5) * 0.4,
        )
        transform.scale.setScalar(scale)
        transform.updateMatrix()
        pieces.setMatrixAt(i, transform.matrix)
        if (colours) pieces.setColorAt(i, tint.setHex(colours[Math.floor(random() * colours.length)]))
      }
      pieces.instanceMatrix.needsUpdate = true
      if (colours) pieces.instanceColor.needsUpdate = true
    }

    const greens = [0x5f9b3a, 0x7bb547, 0x4a7f2c, 0x93c45a]
    scatter(leafGeometry, leafMaterial, 46, {
      inner: 0.05,
      outer: 0.97,
      lift: 0.03,
      tilt: -Math.PI / 2,
      size: [0.75, 1.1],
      colours: greens,
    })
    // Toppings sit in neat sections, like a poke bowl.
    scatter(tofuGeometry, tofuMaterial, 6, { from: 0, to: 1.2, inner: 0.32, lift: 0.13 })
    scatter(tomatoGeometry, tomatoMaterial, 7, { from: 1.3, to: 2.5, inner: 0.32, lift: 0.11 })
    scatter(
      new THREE.SphereGeometry(0.05, 16, 10).scale(1.5, 0.8, 0.85),
      new THREE.MeshStandardMaterial({ color: 0x86b54d, roughness: 0.45 }),
      16,
      { from: 2.6, to: 3.75, inner: 0.32, lift: 0.06 },
    )
    scatter(
      new RoundedBoxGeometry(0.045, 0.04, 0.045, 2, 0.012),
      new THREE.MeshPhysicalMaterial({ color: 0xf3c13f, roughness: 0.35, clearcoat: 0.5 }),
      34,
      { from: 3.85, to: 5, inner: 0.32, lift: 0.05 },
    )
    // Cucumber slices: dark skin round the edge, pale flesh on the faces.
    const cucumberFlesh = new THREE.MeshStandardMaterial({ color: 0xd2e6a4, roughness: 0.4 })
    scatter(
      new THREE.CylinderGeometry(0.075, 0.075, 0.03, 24),
      [new THREE.MeshStandardMaterial({ color: 0x2f5e24, roughness: 0.5 }), cucumberFlesh, cucumberFlesh],
      9,
      { from: 5.1, to: 6.2, inner: 0.32, lift: 0.05, tilt: 0.2 },
    )
    // Shredded red cabbage frames the toppings around the edge of the bowl.
    const cabbageGeometry = new THREE.BoxGeometry(0.24, 0.012, 0.035, 10, 1, 1)
    const cabbagePoints = cabbageGeometry.attributes.position
    for (let i = 0; i < cabbagePoints.count; i++)
      cabbagePoints.setZ(i, cabbagePoints.getZ(i) + 1.6 * cabbagePoints.getX(i) ** 2)
    cabbageGeometry.computeVertexNormals()
    scatter(
      cabbageGeometry,
      new THREE.MeshStandardMaterial({ color: 0x6e2a63, roughness: 0.45 }),
      18,
      { inner: 0.82, outer: 0.96, lift: 0.04, tilt: 0 },
    )
    scatter(
      new THREE.SphereGeometry(0.012, 8, 6).scale(1.6, 0.7, 1),
      new THREE.MeshStandardMaterial({ color: 0xf4ecd8, roughness: 0.5 }),
      60,
      { inner: 0.05, outer: 0.85, lift: 0.1, tilt: 0 },
    )
    // Two soft-boiled egg halves in the centre.
    const eggWhite = new THREE.MeshPhysicalMaterial({ color: 0xfbf8f0, roughness: 0.3, clearcoat: 0.5 })
    const yolk = new THREE.MeshPhysicalMaterial({ color: 0xf2a31d, roughness: 0.35, clearcoat: 0.6 })
    const eggGeometry = new THREE.SphereGeometry(0.15, 32, 16).scale(1, 0.5, 1.3)
    const yolkGeometry = new THREE.SphereGeometry(0.075, 24, 12).scale(1, 0.5, 1.1)
    for (const side of [-1, 1]) {
      const egg = new THREE.Group()
      egg.position.set(side * 0.13, bedSurface(0.13) + 0.06, side * 0.04)
      egg.rotation.set(side * 0.08, side * 0.3, 0)
      addMesh(eggGeometry, eggWhite, egg)
      addMesh(yolkGeometry, yolk, egg).position.y = 0.05
      bowl.add(egg)
    }

    // ---------- Two small plates that circle the bowl ----------
    // Two faint rings trace the path the small plates travel along.
    const plateOrbit = 1.85
    const ringGeometry = new THREE.TorusGeometry(1, 0.003, 6, 128)
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xad4532,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    })
    for (const radius of [plateOrbit, plateOrbit + 0.17]) {
      const ring = addMesh(ringGeometry, ringMaterial, world, false)
      ring.rotation.x = -Math.PI / 2
      ring.scale.setScalar(radius)
    }
    const plateGeometry = dishGeometry([
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
    ])
    function smallPlate() {
      const plate = new THREE.Group()
      plate.scale.setScalar(0.6)
      addMesh(plateGeometry, porcelain, plate)
      world.add(plate)
      return plate
    }

    // Glazed bread rolls topped with sesame.
    const breadPlate = smallPlate()
    const bunGeometry = new THREE.SphereGeometry(0.36, 40, 24).scale(1.1, 0.68, 0.92)
    const bunMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xc9853f,
      roughness: 0.5,
      clearcoat: 0.45,
      clearcoatRoughness: 0.35,
      bumpMap: speckle,
      bumpScale: 1.5,
    })
    const seedGeometry = new THREE.SphereGeometry(0.018, 8, 6).scale(1.6, 0.6, 1)
    const seedMaterial = new THREE.MeshStandardMaterial({ color: 0xf6edd6, roughness: 0.5 })
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + 0.4
      const bun = new THREE.Group()
      bun.position.set(Math.cos(angle) * 0.34, 0.2, Math.sin(angle) * 0.34)
      bun.rotation.y = angle
      addMesh(bunGeometry, bunMaterial, bun)
      const seeds = addMesh(seedGeometry, seedMaterial, bun, false, 12)
      for (let s = 0; s < 12; s++) {
        const seedAngle = random() * Math.PI * 2
        const seedRadius = Math.sqrt(random()) * 0.26
        transform.position.set(
          Math.cos(seedAngle) * seedRadius,
          0.235 - seedRadius * 0.35,
          Math.sin(seedAngle) * seedRadius,
        )
        transform.rotation.set(0, random() * Math.PI, 0)
        transform.scale.setScalar(1)
        transform.updateMatrix()
        seeds.setMatrixAt(s, transform.matrix)
      }
      breadPlate.add(bun)
    }

    // Orange slices fanned out beside a bunch of grapes.
    const fruitPlate = smallPlate()
    const orangeFlesh = new THREE.MeshStandardMaterial({ map: orangeFace, roughness: 0.35 })
    const orangeSlice = new THREE.CylinderGeometry(0.3, 0.3, 0.07, 48)
    const orangeRind = new THREE.MeshStandardMaterial({ color: 0xe8781f, roughness: 0.5 })
    for (let i = 0; i < 3; i++) {
      const slice = addMesh(orangeSlice, [orangeRind, orangeFlesh, orangeFlesh], fruitPlate)
      slice.position.set(-0.42 + i * 0.2, 0.17 + i * 0.05, -0.05 + i * 0.06)
      slice.rotation.set(0.12, 0, -0.32)
    }
    const grapes = addMesh(
      new THREE.SphereGeometry(0.1, 24, 16),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.22,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
      }),
      fruitPlate,
      true,
      14,
    )
    // Three stacked layers make a small pyramid-shaped bunch.
    const grapeLayers = [
      [7, 0.22, 0.2],
      [5, 0.14, 0.36],
      [2, 0.07, 0.5],
    ]
    let grape = 0
    for (const [count, radius, height] of grapeLayers) {
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + height
        transform.position.set(0.32 + Math.cos(angle) * radius, height, 0.18 + Math.sin(angle) * radius)
        transform.rotation.set(0, 0, 0)
        transform.scale.setScalar(0.92 + random() * 0.16)
        transform.updateMatrix()
        grapes.setMatrixAt(grape, transform.matrix)
        grapes.setColorAt(grape, tint.setHex(random() > 0.5 ? 0x5b2a63 : 0x6d3373))
        grape++
      }
    }
    grapes.instanceColor.needsUpdate = true
    const smallPlates = [breadPlate, fruitPlate]

    // ---------- Floating ingredients: tomatoes bounce, tofu hovers, leaves sway ----------
    function cherryTomato() {
      const tomato = new THREE.Group()
      addMesh(tomatoGeometry, tomatoMaterial, tomato)
      // Five little sepals and a stem make the green top.
      const sepalGeometry = new THREE.BoxGeometry(0.06, 0.008, 0.016)
      for (let i = 0; i < 5; i++) {
        const sepal = addMesh(sepalGeometry, stemMaterial, tomato, false)
        sepal.rotation.set(0, (i / 5) * Math.PI * 2, -0.25)
        sepal.position.set(Math.cos((i / 5) * Math.PI * 2) * 0.025, 0.088, -Math.sin((i / 5) * Math.PI * 2) * 0.025)
      }
      addMesh(new THREE.CylinderGeometry(0.006, 0.008, 0.05, 8), stemMaterial, tomato, false).position.y =
        0.11
      tomato.traverse((part) => (part.castShadow = false))
      tomato.scale.setScalar(1.7)
      world.add(tomato)
      return tomato
    }
    // Items high in the air cast no shadow; on the invisible floor it would look like a stray smudge.
    function floatingLeaf(colour) {
      const leaf = addMesh(
        leafGeometry,
        new THREE.MeshStandardMaterial({
          color: colour,
          map: veins,
          roughness: 0.5,
          side: THREE.DoubleSide,
        }),
        world,
        false,
      )
      leaf.scale.setScalar(0.9)
      return leaf
    }
    function floatingTofu() {
      const tofu = addMesh(tofuGeometry, tofuMaterial, world, false)
      tofu.scale.setScalar(1.6)
      return tofu
    }
    // Tomatoes and leaves bob in place around the bowl, including the front;
    // the three tofu cubes circle the bowl between the plates.
    const floaters = [
      { mesh: floatingTofu(), motion: 'tofu', x: 0, y: 0.6, z: 0 },
      { mesh: floatingTofu(), motion: 'tofu', x: 0, y: 0.75, z: 0 },
      { mesh: floatingTofu(), motion: 'tofu', x: 0, y: 0.55, z: 0 },
      { mesh: cherryTomato(), motion: 'tomato', x: -2.15, y: 0.45, z: 1.1 },
      { mesh: cherryTomato(), motion: 'tomato', x: 1.75, y: 0.6, z: -1.6 },
      { mesh: floatingLeaf(0x6fae42), motion: 'sway', x: -1.45, y: 0.8, z: -1.7 },
      { mesh: floatingLeaf(0x5c9a36), motion: 'sway', x: 1.8, y: 0.5, z: 1.55 },
    ]
    const tofuOrbit = plateOrbit + 0.08

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
      // The whole scene tilts towards the mouse and sways slowly on its own.
      world.rotation.x += (mouseY * 0.16 + Math.sin(elapsed / 3) * 0.06 - world.rotation.x) * 0.12
      world.rotation.y += (mouseX * 0.28 - world.rotation.y) * 0.12
      world.rotation.z += (-0.12 - world.rotation.z) * 0.12
      world.position.x += (mouseX * 0.12 - world.position.x) * 0.12

      // The bowl stays still; the two small plates ride the rings on opposite sides
      // (one lap every 16 seconds) and spin on their own axes in opposite directions.
      const angle = (elapsed * Math.PI * 2) / 16 + 0.9
      smallPlates.forEach((plate, index) => {
        plate.position.set(
          Math.sin(angle + index * Math.PI) * plateOrbit,
          0.12,
          Math.cos(angle + index * Math.PI) * plateOrbit,
        )
        plate.rotation.y = elapsed * 0.6 * (index ? -1 : 1)
      })

      floaters.forEach(({ mesh, motion, x, y, z }, index) => {
        mesh.position.set(x, y + Math.sin(elapsed * 0.9 + index) * 0.09, z)
        if (motion === 'tofu') {
          // Tofu travels round the rings a quarter-turn away from the plates, tumbling as it goes.
          const phase = angle + Math.PI / 2 + (index % 2) * Math.PI + index * 0.18
          mesh.position.x = Math.sin(phase) * tofuOrbit
          mesh.position.z = Math.cos(phase) * tofuOrbit
          mesh.rotation.set(0.4 + elapsed * 0.18, elapsed * 0.25 + index, 0.3)
        } else if (motion === 'tomato') {
          mesh.rotation.set(Math.sin(elapsed * 0.6 + index) * 0.15, index, 0.15)
        } else {
          // Tilted back towards the camera so the leaf shows its face, not its edge.
          mesh.rotation.set(
            -0.55 + Math.sin(elapsed * 1.2 + index) * 0.2,
            Math.sin(elapsed * 0.5 + index) * 0.3,
            0.4 + Math.sin(elapsed * 0.7 + index) * 0.25,
          )
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
