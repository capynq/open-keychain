export type RecoveryStrategy =
  | 'text-edge'
  | 'base-edge'
  | 'font'
  | 'size'
  | 'connectivity'
  | 'geometry'
  | 'retry'
  | 'manual'
  | 'share'
  | 'photo'
  | 'export'
  | 'preview'
  | 'unknown';

export type RecoveryDefinition = {
  messageKey: string;
  stepsKey?: string;
  strategy: RecoveryStrategy;
};

const issue = (
  messageKey: string,
  strategy: RecoveryStrategy = 'manual',
  stepsKey = `recovery.steps.${strategy}`,
): RecoveryDefinition => ({
  messageKey,
  stepsKey,
  strategy,
});

export const RECOVERY_CATALOG: Record<string, RecoveryDefinition> = {
  'empty-text': issue('errorEmptyText', 'manual'),
  'text-too-long': issue('errorTooLong', 'manual'),
  'font-load': issue('errorFontLoad', 'font'),
  'missing-glyph': issue('errorMissingGlyph', 'font'),
  'subtitle-font-load': issue('errorSubtitleFontLoad', 'font'),
  'subtitle-missing-glyph': issue('errorSubtitleMissingGlyph', 'font'),
  'articulated-font': issue('errorArticulatedFont', 'font'),
  'empty-outline': issue('errorEmptyOutline', 'font'),
  'text-too-wide': issue('errorTooWide', 'size'),
  'subtitle-too-long': issue('errorSubtitleTooLong', 'manual'),
  'magnet-base-adjusted': issue('warningMagnetBaseAdjusted', 'manual'),
  'magnet-pocket-adjusted': issue('warningMagnetPocketAdjusted', 'manual'),
  'magnet-pocket-unsafe': issue('errorMagnetPocketUnsafe', 'geometry'),
  disconnected: issue('warningDisconnected', 'connectivity'),
  'relief-outside-backing': issue('errorReliefOutsideBacking', 'geometry'),
  'nameplate-text-outside-plate': issue('errorNameplateTextOutside', 'size'),
  'nameplate-embedding': issue('errorNameplateEmbedding', 'geometry'),
  'scaled-to-fit': issue('warningScaled', 'size'),
  'text-over-width': issue('warningTextOverWidth', 'size'),
  'dense-mesh': issue('warningDense', 'geometry'),
  'shallow-relief': issue('warningShallow', 'geometry'),
  'articulated-base-adjusted': issue('warningArticulatedBaseAdjusted', 'manual'),
  'articulated-captive': issue('errorArticulatedJoint', 'connectivity'),
  'articulated-counter': issue('errorArticulatedJoint', 'connectivity'),
  'articulated-manifold': issue('errorArticulatedJoint', 'connectivity'),
  'articulated-body-collision': issue('errorArticulatedJoint', 'connectivity'),
  'articulated-connector-collision': issue('errorArticulatedJoint', 'connectivity'),
  'articulated-motion-collision': issue('errorArticulatedJoint', 'connectivity'),
  'articulated-shell-count': issue('errorArticulatedJoint', 'connectivity'),
  'heart-cut-unsafe': issue('errorHeartCutUnsafe', 'connectivity'),
  'size-envelope-fit': issue('warningSizeEnvelopeFit', 'size'),
  'size-envelope-unavailable': issue('errorSizeEnvelopeUnavailable', 'size'),
  'feature-unsupported-template': issue('errorFeatureUnsupportedTemplate', 'manual'),
  'feature-manufacturing-unverified': issue('warningFeatureManufacturingUnverified', 'manual'),
  'feature-geometry': issue('errorFeatureGeometry', 'geometry'),
  'base-edge-too-large': issue('recovery.baseEdgeTooLarge', 'base-edge'),
  'base-edge-wall-too-thin': issue('recovery.baseEdgeWallTooThin', 'base-edge'),
  'base-edge-invalid': issue('recovery.baseEdgeInvalid', 'base-edge'),
  'text-edge-too-large': issue('recovery.textEdgeTooLarge', 'text-edge'),
  'text-edge-topology': issue('recovery.textEdgeTopology', 'text-edge'),
  'text-edge-invalid': issue('recovery.textEdgeInvalid', 'text-edge'),
  'text-edge-no-effect': issue('recovery.textEdgeNoEffect', 'text-edge'),
  'text-edge-dimensions': issue('recovery.textEdgeDimensions', 'text-edge'),
  'text-edge-profile': issue('recovery.textEdgeProfile', 'text-edge'),
  'geometry-build-failed': issue('recovery.geometryBuildFailed', 'geometry'),
  'geometry-parameter-limit': issue('recovery.geometryParameterLimit', 'geometry'),
  'geometry-worker-init-failed': issue('recovery.geometryWorkerFailed', 'retry'),
  'geometry-worker-failed': issue('recovery.geometryWorkerFailed', 'retry'),
  'geometry-request-timeout': issue('recovery.geometryRequestTimeout', 'retry'),
  'geometry-invalid-result': issue('recovery.geometryInvalidResult', 'geometry'),
  'geometry-client-disposed': issue('recovery.geometryClientDisposed', 'manual'),
  'geometry-candidate-superseded': issue('recovery.geometryCandidateSuperseded', 'preview'),
  'geometry-export-failed': issue('recovery.geometryExportFailed', 'export'),
  'unknown-failure': issue('recovery.unknown', 'unknown'),
  'local-font-restore-failed': issue('errorFontLoad', 'font'),
  'generation-error': issue('recovery.geometryBuildFailed', 'geometry'),
  'candidate-invalid': issue('recovery.geometryInvalidResult', 'preview'),
  'photo-capture-failed': issue('recovery.photoCaptureFailed', 'photo'),
  'photo-download-blocked': issue('recovery.photoDownloadBlocked', 'photo'),
  'photo-format-unsupported': issue('recovery.photoFormatUnsupported', 'photo'),
  'canvas-unavailable': issue('recovery.canvasUnavailable', 'photo'),
  'image-encoding-failed': issue('recovery.imageEncodingFailed', 'photo'),
  'export-file-failed': issue('recovery.geometryExportFailed', 'export'),
  'batch-export-failed': issue('recovery.geometryExportFailed', 'export'),
  'invalid-design': issue('recovery.invalidDesign', 'manual'),
  'invalid-size': issue('recovery.invalidSize', 'size'),
  'feature-invalid': issue('errorFeatureGeometry', 'geometry'),
  'invalid-template': issue('recovery.invalidTemplate', 'manual'),
  'invalid-style': issue('recovery.invalidStyle', 'manual'),
  'unsupported-style': issue('recovery.unsupportedStyle', 'manual'),
  'subtitle-unsupported': issue('recovery.subtitleUnsupported', 'manual'),
  'preview-camera-invalid': issue('recovery.previewUnavailable', 'preview'),
  'preview-render-failed': issue('recovery.previewUnavailable', 'preview'),
  'preview-context-lost': issue('recovery.previewUnavailable', 'preview'),
  'preview-unavailable': issue('recovery.previewUnavailable', 'preview'),
  'share-failed': issue('recovery.shareFailed', 'share'),
  'share-invalid': issue('recovery.shareInvalid', 'share'),
  'share-clipboard-failed': issue(
    'recovery.shareClipboardFailed',
    'share',
    'recovery.steps.shareClipboardFailed',
  ),
  'share-native-failed': issue(
    'recovery.shareNativeFailed',
    'share',
    'recovery.steps.shareNativeFailed',
  ),
  'route-load-failed': issue('recovery.routeLoadFailed', 'retry', 'recovery.steps.routeLoadFailed'),
  'setup-rejected': issue('recovery.setupRejected', 'manual', 'recovery.steps.setupRejected'),
  'randomize-failed': issue('recovery.randomizeFailed', 'retry', 'recovery.steps.randomizeFailed'),
  'local-font-import-failed': issue(
    'recovery.localFontImportFailed',
    'font',
    'recovery.steps.localFontImportFailed',
  ),
  'google-font-missing-api-key': issue(
    'recovery.googleFontMissingApiKey',
    'manual',
    'recovery.steps.googleFontMissingApiKey',
  ),
  'google-font-network': issue(
    'recovery.googleFontNetwork',
    'retry',
    'recovery.steps.googleFontNetwork',
  ),
  'google-font-failed': issue(
    'recovery.googleFontFailed',
    'retry',
    'recovery.steps.googleFontFailed',
  ),
  'google-font-timeout': issue(
    'recovery.googleFontTimeout',
    'retry',
    'recovery.steps.googleFontTimeout',
  ),
  'google-font-http': issue('recovery.googleFontHttp', 'retry', 'recovery.steps.googleFontHttp'),
  'google-font-payload-too-large': issue(
    'recovery.googleFontPayloadTooLarge',
    'manual',
    'recovery.steps.googleFontPayloadTooLarge',
  ),
  'google-font-invalid-payload': issue(
    'recovery.googleFontInvalidPayload',
    'manual',
    'recovery.steps.googleFontInvalidPayload',
  ),
};

export const recoveryDefinition = (code: string): RecoveryDefinition =>
  RECOVERY_CATALOG[code] ?? RECOVERY_CATALOG['unknown-failure'];
