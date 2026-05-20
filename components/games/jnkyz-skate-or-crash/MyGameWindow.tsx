"use client";

import React, { useEffect, useRef } from "react";
import { Game } from "@/lib/games";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { Howl } from "howler";

interface MyGameWindowProps {
    game: Game;
    multiplier: number;
    crashAt: number | null;
    isGameOngoing: boolean;
    isCrashed: boolean;
    elapsedMs: number;
    didCashout: boolean;
    sfxMuted: boolean;
}

const MyGameWindow: React.FC<MyGameWindowProps> = ({
    game,
    multiplier,
    crashAt,
    isGameOngoing,
    isCrashed,
    elapsedMs,
    didCashout,
    sfxMuted,
}) => {
    const canvasContainerRef = useRef<HTMLDivElement | null>(null);
    const mixerRef = useRef<THREE.AnimationMixer | null>(null);
    const skateIntroActionRef = useRef<THREE.AnimationAction | null>(null);
    const skateLoopActionRef = useRef<THREE.AnimationAction | null>(null);
    const fallActionRef = useRef<THREE.AnimationAction | null>(null);
    const fallSitActionRef = useRef<THREE.AnimationAction | null>(null);
    const skateboardMixerRef = useRef<THREE.AnimationMixer | null>(null);
    const skateboardIntroActionRef = useRef<THREE.AnimationAction | null>(null);
    const skateboardLoopActionRef = useRef<THREE.AnimationAction | null>(null);
    const activeActionRef = useRef<THREE.AnimationAction | null>(null);
    const runnerRootRef = useRef<THREE.Object3D | null>(null);
    const runnerAnchorPosRef = useRef<THREE.Vector3 | null>(null);
    const skateboardRootRef = useRef<THREE.Object3D | null>(null);
    const skateboardAnchorPosRef = useRef<THREE.Vector3 | null>(null);
    const bgSegmentsRef = useRef<THREE.Object3D[]>([]);
    const skateLoopSfxRef = useRef<Howl | null>(null);
    const crashSfxRef = useRef<Howl | null>(null);
    const isGameOngoingRef = useRef(isGameOngoing);
    const multiplierRef = useRef(multiplier);
    const isCrashedRef = useRef(isCrashed);
    const lastRunAnimSpeedRef = useRef(1);
    const wasCrashedRef = useRef(isCrashed);

    useEffect(() => {
        isGameOngoingRef.current = isGameOngoing;
        multiplierRef.current = multiplier;
        isCrashedRef.current = isCrashed;
    }, [isGameOngoing, multiplier, isCrashed]);

    useEffect(() => {
        skateLoopSfxRef.current = new Howl({
            src: ["/submissions/jnkyz-skate-or-crash/audio/skate-loop.ogg"],
            loop: true,
            volume: 0.42,
            mute: sfxMuted,
        });
        crashSfxRef.current = new Howl({
            src: ["/submissions/jnkyz-skate-or-crash/audio/skate-crash.ogg"],
            loop: false,
            volume: 0.9,
            mute: sfxMuted,
        });
        return () => {
            skateLoopSfxRef.current?.unload();
            crashSfxRef.current?.unload();
            skateLoopSfxRef.current = null;
            crashSfxRef.current = null;
        };
    }, []);

    useEffect(() => {
        skateLoopSfxRef.current?.mute(sfxMuted);
        crashSfxRef.current?.mute(sfxMuted);
    }, [sfxMuted]);

    useEffect(() => {
        const skateLoop = skateLoopSfxRef.current;
        if (skateLoop) {
            if (!isCrashed) {
                if (!skateLoop.playing()) {
                    skateLoop.play();
                }
            } else if (skateLoop.playing()) {
                skateLoop.stop();
            }
        }

        if (!wasCrashedRef.current && isCrashed) {
            crashSfxRef.current?.stop();
            crashSfxRef.current?.play();
        }
        wasCrashedRef.current = isCrashed;
    }, [isGameOngoing, isCrashed]);

    useEffect(() => {
        if (!canvasContainerRef.current) {
            return;
        }

        const container = canvasContainerRef.current;
        const scene = new THREE.Scene();
        const worldGroup = new THREE.Group();
        const masterScaleGroup = new THREE.Group();
        worldGroup.visible = false;
        masterScaleGroup.scale.setScalar(0.8);
        scene.add(masterScaleGroup);
        masterScaleGroup.add(worldGroup);
        const loadedParts = {
            runner: false,
            skateboard: false,
            background: false,
        };
        const updateWorldVisibility = (): void => {
            worldGroup.visible = loadedParts.runner && loadedParts.skateboard && loadedParts.background;
        };

        const camera = new THREE.PerspectiveCamera(
            45,
            container.clientWidth / container.clientHeight,
            0.1,
            1000,
        );
        // Use persisted camera state if available so frame is not reset.
        const fallbackCamera = {
            position: { x: -12.9621, y: 8.3963, z: -19.1387 },
            target: { x: -0.1191, y: 0.6929, z: -0.0608 },
            fov: 8,
        };
        let initialCamera = fallbackCamera;
        try {
            const raw = window.localStorage.getItem("skateCrashCameraState");
            if (raw) {
                const parsed = JSON.parse(raw) as typeof fallbackCamera;
                if (parsed?.position && parsed?.target && typeof parsed?.fov === "number") {
                    initialCamera = parsed;
                }
            }
        } catch {
            // ignore malformed local storage data
        }
        camera.position.set(
            initialCamera.position.x,
            initialCamera.position.y,
            initialCamera.position.z,
        );
        camera.fov = initialCamera.fov;
        camera.updateProjectionMatrix();
        camera.lookAt(
            initialCamera.target.x,
            initialCamera.target.y,
            initialCamera.target.z,
        );

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(container.clientWidth, container.clientHeight, false);
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);

        const hemi = new THREE.HemisphereLight(0xbdeeff, 0x1d2a33, 0.95);
        scene.add(hemi);

        const keyLight = new THREE.DirectionalLight(0xffffff, 0.95);
        keyLight.position.set(3.2, 5.6, 1.8);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(1024, 1024);
        keyLight.shadow.camera.near = 0.5;
        keyLight.shadow.camera.far = 60;
        keyLight.shadow.camera.left = -14;
        keyLight.shadow.camera.right = 14;
        keyLight.shadow.camera.top = 12;
        keyLight.shadow.camera.bottom = -12;
        keyLight.shadow.bias = -0.00035;
        keyLight.shadow.normalBias = 0.02;
        keyLight.shadow.radius = 3;
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0x9bd6ff, 0.32);
        fillLight.position.set(-2.8, 2.6, -2.2);
        scene.add(fillLight);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enabled = false;
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.target.set(
            initialCamera.target.x,
            initialCamera.target.y,
            initialCamera.target.z,
        );
        controls.update();

        const loader = new GLTFLoader();
        loader.setMeshoptDecoder(MeshoptDecoder);
        const clock = new THREE.Clock();
        let disposed = false;
        let runnerRoot: THREE.Object3D | null = null;
        let skateboardRoot: THREE.Object3D | null = null;
        let animationFrame = 0;
        let laneLength = 16;
        const segmentCount = 12;
        let recycleBehindZ = -20;
        const loopAxis: "z" = "z";
        const bgUniformScale = 1;
        const bgLateralOffsetX = 0;
        const bgVerticalOffsetY = 0;
        const bgDepthOffsetZ = 0;
        const bgYawDegrees = 0;

        const playAction = (action: THREE.AnimationAction | null): void => {
            if (!action) {
                return;
            }
            if (activeActionRef.current === action) {
                return;
            }
            activeActionRef.current?.fadeOut(0.2);
            action.reset().fadeIn(0.2).play();
            activeActionRef.current = action;
        };

        loader.load(
            "/submissions/jnkyz-skate-or-crash/JNKYZ_Animset.glb",
            (gltf) => {
                if (disposed) {
                    return;
                }

                const model = gltf.scene;
                runnerRoot = model;
                runnerRootRef.current = model;
                model.traverse((obj) => {
                    const mesh = obj as THREE.Mesh;
                    if (mesh.isMesh) {
                        mesh.castShadow = true;
                        mesh.receiveShadow = true;
                    }
                });
                worldGroup.add(model);
                runnerAnchorPosRef.current = model.position.clone();

                const mixer = new THREE.AnimationMixer(model);
                mixerRef.current = mixer;

                const clips = gltf.animations;
                const skatingClip =
                    clips.find((clip) => clip.name === "Skating") ??
                    clips.find((clip) => /skating|skate|run/i.test(clip.name)) ??
                    clips[0] ??
                    null;
                const skatingLoopClip =
                    clips.find((clip) => clip.name === "Skating_Loop") ??
                    skatingClip;
                const fallingClip =
                    clips.find((clip) => clip.name === "Falling") ??
                    clips.find((clip) => /fall|crash|die|hit/i.test(clip.name)) ??
                    clips[1] ??
                    clips[0] ??
                    null;
                const fallingSitClip =
                    clips.find((clip) => clip.name === "Falling_Sit") ?? fallingClip;

                skateIntroActionRef.current = skatingClip ? mixer.clipAction(skatingClip) : null;
                skateLoopActionRef.current = skatingLoopClip ? mixer.clipAction(skatingLoopClip) : null;
                fallActionRef.current = fallingClip ? mixer.clipAction(fallingClip) : null;
                fallSitActionRef.current = fallingSitClip ? mixer.clipAction(fallingSitClip) : null;

                if (skateIntroActionRef.current) {
                    skateIntroActionRef.current.loop = THREE.LoopRepeat;
                    skateIntroActionRef.current.clampWhenFinished = false;
                    skateIntroActionRef.current.enabled = true;
                }
                if (skateLoopActionRef.current) {
                    skateLoopActionRef.current.loop = THREE.LoopRepeat;
                    skateLoopActionRef.current.clampWhenFinished = false;
                    skateLoopActionRef.current.enabled = true;
                }

                if (fallActionRef.current) {
                    fallActionRef.current.clampWhenFinished = true;
                    fallActionRef.current.loop = THREE.LoopOnce;
                    fallActionRef.current.enabled = true;
                }
                if (fallSitActionRef.current) {
                    fallSitActionRef.current.clampWhenFinished = true;
                    fallSitActionRef.current.loop = THREE.LoopOnce;
                    fallSitActionRef.current.enabled = true;
                }

                playAction(
                    skateIntroActionRef.current ??
                    skateLoopActionRef.current,
                );
                loadedParts.runner = true;
                updateWorldVisibility();
            },
            undefined,
            () => {
                // Keep game playable even if model fails to load.
            },
        );

        loader.load(
            "/submissions/jnkyz-skate-or-crash/JNKYZ_Skateboard.glb",
            (gltf) => {
                if (disposed) {
                    return;
                }

                const board = gltf.scene;
                skateboardRoot = board;
                skateboardRootRef.current = board;
                board.traverse((obj) => {
                    const mesh = obj as THREE.Mesh;
                    if (mesh.isMesh) {
                        mesh.castShadow = true;
                        mesh.receiveShadow = true;
                    }
                });
                worldGroup.add(board);
                skateboardAnchorPosRef.current = board.position.clone();

                const mixer = new THREE.AnimationMixer(board);
                skateboardMixerRef.current = mixer;
                const clips = gltf.animations;
                const boardIntroClip =
                    clips.find((clip) => clip.name === "Skateboard_Skating") ??
                    clips.find((clip) => clip.name === "Skateboard Animation") ??
                    clips.find((clip) => /skateboard|skating|skate/i.test(clip.name)) ??
                    clips[0] ??
                    null;
                const boardLoopClip =
                    clips.find((clip) => clip.name === "Skateboard_Skating_Loop") ??
                    boardIntroClip;

                skateboardIntroActionRef.current = boardIntroClip ? mixer.clipAction(boardIntroClip) : null;
                skateboardLoopActionRef.current = boardLoopClip ? mixer.clipAction(boardLoopClip) : null;

                if (skateboardIntroActionRef.current) {
                    skateboardIntroActionRef.current.loop = THREE.LoopRepeat;
                    skateboardIntroActionRef.current.clampWhenFinished = false;
                    skateboardIntroActionRef.current.enabled = true;
                    skateboardIntroActionRef.current.setEffectiveWeight(1);
                    skateboardIntroActionRef.current.setEffectiveTimeScale(1);
                    skateboardIntroActionRef.current.stop();
                    if (!isCrashedRef.current) {
                        skateboardIntroActionRef.current.reset().play();
                    }
                }
                if (skateboardLoopActionRef.current) {
                    skateboardLoopActionRef.current.loop = THREE.LoopRepeat;
                    skateboardLoopActionRef.current.clampWhenFinished = false;
                    skateboardLoopActionRef.current.enabled = true;
                    skateboardLoopActionRef.current.setEffectiveWeight(1);
                    skateboardLoopActionRef.current.setEffectiveTimeScale(1);
                    skateboardLoopActionRef.current.stop();
                }
                loadedParts.skateboard = true;
                updateWorldVisibility();
            },
            undefined,
            () => {
                // Optional model; game remains playable without skateboard mesh.
            },
        );

        loader.load(
            "/submissions/jnkyz-skate-or-crash/JNKYZ_Bg.glb",
            (gltf) => {
                if (disposed) {
                    return;
                }

                const source = gltf.scene;
                source.traverse((obj) => {
                    const mesh = obj as THREE.Mesh;
                    if (mesh.isMesh) {
                        // Allow contact shadows from skater/board on the track,
                        // while preventing giant building cast-shadows.
                        mesh.castShadow = false;
                        mesh.receiveShadow = true;
                    }
                });

                const sourceBounds = new THREE.Box3().setFromObject(source);
                const sourceSize = new THREE.Vector3();
                sourceBounds.getSize(sourceSize);
                const segmentScale = bgUniformScale;
                laneLength = Math.max(sourceSize.z * segmentScale * 0.98, 8);
                recycleBehindZ = camera.position.z - laneLength * 3;

                const createdSegments: THREE.Object3D[] = [];
                const startZ = camera.position.z - laneLength * 3;
                for (let i = 0; i < segmentCount; i += 1) {
                    // Wrap clone so we can recenter the imported GLB before segment placement.
                    const segmentGroup = new THREE.Group();
                    const clone = source.clone(true);
                    clone.scale.setScalar(segmentScale);
                    clone.rotation.y = THREE.MathUtils.degToRad(bgYawDegrees);
                    // Respect authored transform from the GLB exactly.
                    clone.position.set(0, 0, 0);
                    segmentGroup.add(clone);

                    segmentGroup.position.set(
                        bgLateralOffsetX,
                        bgVerticalOffsetY,
                        startZ + i * laneLength + bgDepthOffsetZ,
                    );

                    worldGroup.add(segmentGroup);
                    createdSegments.push(segmentGroup);
                }
                bgSegmentsRef.current = createdSegments;
                loadedParts.background = true;
                updateWorldVisibility();
            },
            undefined,
            () => {
            },
        );

        const onResize = (): void => {
            if (!container) {
                return;
            }
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight, false);
            renderer.domElement.style.width = "100%";
            renderer.domElement.style.height = "100%";
        };

        window.addEventListener("resize", onResize);

        const animate = (): void => {
            if (disposed) {
                return;
            }
            animationFrame = requestAnimationFrame(animate);
            controls.update();
            try {
                window.localStorage.setItem(
                    "skateCrashCameraState",
                    JSON.stringify({
                        position: {
                            x: Number(camera.position.x.toFixed(4)),
                            y: Number(camera.position.y.toFixed(4)),
                            z: Number(camera.position.z.toFixed(4)),
                        },
                        target: {
                            x: Number(controls.target.x.toFixed(4)),
                            y: Number(controls.target.y.toFixed(4)),
                            z: Number(controls.target.z.toFixed(4)),
                        },
                        fov: Number(camera.fov.toFixed(4)),
                    }),
                );
            } catch {
                // ignore storage failures
            }
            const dt = clock.getDelta();
            const animSpeed = isGameOngoingRef.current
                ? 1.15 + Math.min(Math.max(multiplierRef.current - 1, 0), 10) * 0.12
                : 1;
            if (!isCrashedRef.current) {
                lastRunAnimSpeedRef.current = animSpeed;
            }
            if (skateIntroActionRef.current) {
                skateIntroActionRef.current.timeScale = animSpeed;
            }
            if (skateLoopActionRef.current) {
                skateLoopActionRef.current.timeScale = animSpeed;
            }
            if (skateboardIntroActionRef.current || skateboardLoopActionRef.current) {
                const leaderAction =
                    activeActionRef.current === fallActionRef.current ||
                        activeActionRef.current === fallSitActionRef.current
                        ? null
                        : (activeActionRef.current ?? skateIntroActionRef.current ?? skateLoopActionRef.current);

                if (!isCrashedRef.current && leaderAction) {
                    const leaderDuration = Math.max(leaderAction.getClip().duration, 0.001);
                    const boardFollower =
                        leaderAction === skateLoopActionRef.current
                            ? (skateboardLoopActionRef.current ?? skateboardIntroActionRef.current)
                            : (skateboardIntroActionRef.current ?? skateboardLoopActionRef.current);
                    const boardOther =
                        boardFollower === skateboardLoopActionRef.current
                            ? skateboardIntroActionRef.current
                            : skateboardLoopActionRef.current;
                    if (!boardFollower) {
                        // no-op
                    } else {
                        if (!boardFollower.isRunning()) {
                            boardFollower.reset().play();
                        }
                        boardOther?.stop();
                    const boardDuration = Math.max(boardFollower.getClip().duration, 0.001);
                    const leaderPhase = (leaderAction.time % leaderDuration) / leaderDuration;
                    boardFollower.time = leaderPhase * boardDuration;
                    boardFollower.timeScale = animSpeed;
                    boardFollower.paused = true;
                    }
                }
            }
            if (fallSitActionRef.current) {
                const crashTimeScale = Math.max(
                    1,
                    Math.min(lastRunAnimSpeedRef.current, 2.35),
                );
                fallSitActionRef.current.timeScale = isCrashedRef.current
                    ? crashTimeScale
                    : animSpeed;
            }
            if (fallActionRef.current) {
                const crashTimeScale = Math.max(
                    1,
                    Math.min(lastRunAnimSpeedRef.current, 2.35),
                );
                fallActionRef.current.timeScale = isCrashedRef.current
                    ? crashTimeScale
                    : animSpeed;
            }
            mixerRef.current?.update(dt);
            skateboardMixerRef.current?.update(dt);
            const segmentSpeed = !isCrashedRef.current
                ? (2 + Math.min(Math.max(multiplierRef.current - 1, 0), 12))
                : 0;
            if (segmentSpeed > 0 && bgSegmentsRef.current.length > 0) {
                let maxPos = -Infinity;
                for (const segment of bgSegmentsRef.current) {
                    segment.position.z -= segmentSpeed * dt;
                    if (segment.position.z > maxPos) {
                        maxPos = segment.position.z;
                    }
                }
                for (const segment of bgSegmentsRef.current) {
                    const currentPos = segment.position.z;
                    if (currentPos < recycleBehindZ) {
                        const nextPos = maxPos + laneLength;
                        segment.position.z = nextPos;
                        maxPos = nextPos;
                    }
                }
            }
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            disposed = true;
            cancelAnimationFrame(animationFrame);
            window.removeEventListener("resize", onResize);
            controls.dispose();
            mixerRef.current?.stopAllAction();
            skateboardMixerRef.current?.stopAllAction();
            renderer.dispose();
            if (runnerRoot) {
                worldGroup.remove(runnerRoot);
            }
            if (skateboardRoot) {
                worldGroup.remove(skateboardRoot);
            }
            for (const segment of bgSegmentsRef.current) {
                worldGroup.remove(segment);
            }
            bgSegmentsRef.current = [];
            container.removeChild(renderer.domElement);
        };
    }, []);

    useEffect(() => {
        const boardIntro = skateboardIntroActionRef.current;
        const boardLoop = skateboardLoopActionRef.current;
        if (boardIntro || boardLoop) {
            if (!isCrashed) {
                const preferredBoard = isGameOngoing
                    ? (boardLoop ?? boardIntro)
                    : (boardIntro ?? boardLoop);
                const otherBoard = preferredBoard === boardLoop ? boardIntro : boardLoop;
                if (preferredBoard && !preferredBoard.isRunning()) {
                    preferredBoard.reset().play();
                }
                preferredBoard && (preferredBoard.paused = true);
                otherBoard?.stop();
            } else {
                boardIntro?.stop();
                boardLoop?.stop();
            }
        }

        if (isCrashed) {
            const crashAction = fallSitActionRef.current ?? fallActionRef.current;
            if (crashAction) {
                activeActionRef.current?.fadeOut(0.15);
                crashAction.timeScale = Math.max(
                    1,
                    Math.min(lastRunAnimSpeedRef.current, 2.35),
                );
                crashAction.reset().fadeIn(0.15).play();
                activeActionRef.current = crashAction;
            }
            return;
        }
        const skatingAction = skateIntroActionRef.current ?? skateLoopActionRef.current;
        if (!isCrashed && skatingAction) {
            // Snap transforms back instantly on restart to avoid visible "travel back".
            if (runnerRootRef.current && runnerAnchorPosRef.current) {
                runnerRootRef.current.position.copy(runnerAnchorPosRef.current);
            }
            if (skateboardRootRef.current && skateboardAnchorPosRef.current) {
                skateboardRootRef.current.position.copy(skateboardAnchorPosRef.current);
            }

            if (activeActionRef.current !== skatingAction) {
                activeActionRef.current?.stop();
                skatingAction.reset().play();
                activeActionRef.current = skatingAction;
            }
        }
    }, [isCrashed, isGameOngoing]);

    return (
        <div className="absolute inset-0 z-0 flex items-center justify-center text-white">
            <div className="absolute inset-0 rounded-md overflow-hidden border border-white/15 bg-[#1a1a1a]">
                <div
                    ref={canvasContainerRef}
                    className="absolute inset-0"
                />
                {isCrashed ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="rounded-2xl border border-white/25 bg-black/35 px-8 py-6 text-center">
                            <img
                                src="/submissions/jnkyz-skate-or-crash/ui/jnkyz-art-white-cutout-v3.png"
                                alt="JNKYZ Crashed"
                                className="mx-auto h-24 w-auto bg-transparent object-contain opacity-100"
                                style={{
                                    transform: "scale(1.18) rotate(-5deg)",
                                    filter: "drop-shadow(0 0 20px rgba(255,255,255,0.25))",
                                }}
                            />
                            <div className="mt-3 text-center text-xl font-black uppercase tracking-[0.22em] text-[#FFD7D7]">
                                Wade Crashed
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default MyGameWindow;
