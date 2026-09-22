import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';

export function videoNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'VIDEO_NOT_FOUND',
    message: 'Video was not found',
  });
}

export function videoScopeDenied(): ForbiddenException {
  return new ForbiddenException({
    code: 'VIDEO_SCOPE_DENIED',
    message: 'The fighter is outside your active assignment scope',
  });
}

export function videoMediaTypeUnsupported(): UnsupportedMediaTypeException {
  return new UnsupportedMediaTypeException({
    code: 'VIDEO_MEDIA_TYPE_UNSUPPORTED',
    message: 'Only MP4, MOV, and WebM videos are accepted',
  });
}

export function videoSizeInvalid(): PayloadTooLargeException {
  return new PayloadTooLargeException({
    code: 'VIDEO_SIZE_INVALID',
    message: 'Video size is missing or exceeds the configured limit',
  });
}

export function videoRangeNotSatisfiable(): HttpException {
  return new HttpException(
    {
      code: 'VIDEO_RANGE_INVALID',
      message: 'Range header không hợp lệ.',
    },
    HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
  );
}
