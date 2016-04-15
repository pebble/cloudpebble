from pipeline.storage import PipelineMixin, PipelineStorage
from whitenoise.storage import CompressedManifestStaticFilesStorage, HelpfulExceptionMixin, CompressedStaticFilesMixin

class CompressedManifestPipelineStorage(PipelineMixin, CompressedManifestStaticFilesStorage):
    pass

class CompressedPipelineStorage(HelpfulExceptionMixin, CompressedStaticFilesMixin, PipelineStorage):
    pass
