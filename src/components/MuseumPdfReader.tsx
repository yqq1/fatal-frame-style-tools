import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, FileText, Maximize2, Minus, Plus, RotateCcw, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, TouchEvent, WheelEvent } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { OnProgressParameters, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import type { MuseumDocument, MuseumWork } from '../data/fatalFrameMuseum';
import { getInitialMuseumPdfPage, saveMuseumPdfProgress } from '../lib/museumPdfProgress';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type MuseumPdfReaderProps = {
  document: MuseumDocument;
  work: MuseumWork;
  variant?: 'desktop' | 'mobile';
  onBack: () => void;
};

type PageTurnDirection = 'next' | 'previous' | 'jump';
type ReactTouchList = TouchEvent<HTMLDivElement>['touches'];

function clampPage(page: number, minPage: number, maxPage: number) {
  return Math.min(Math.max(page, minPage), maxPage);
}

function clampZoom(zoom: number) {
  return Math.min(Math.max(zoom, 0.75), 2.5);
}

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

function getImmersiveFitSize() {
  const viewportWidth = Math.floor(window.visualViewport?.width ?? window.innerWidth);
  const viewportHeight = Math.floor(window.visualViewport?.height ?? window.innerHeight);
  const horizontalChrome = viewportWidth <= 760 ? 40 : 120;
  const verticalChrome = viewportWidth <= 760 ? 76 : 64;
  const maxHeight = Math.max(1200, viewportHeight);

  return {
    height: clampPage(viewportHeight - (viewportWidth <= 760 ? verticalChrome : 0), 320, maxHeight),
    width: clampPage(viewportWidth - horizontalChrome, 360, 1400),
  };
}

function getReaderFitHeight(stage: HTMLElement) {
  const viewportWidth = Math.floor(window.visualViewport?.width ?? window.innerWidth);
  const viewportHeight = Math.floor(window.visualViewport?.height ?? window.innerHeight);
  const bottomChrome = viewportWidth <= 760 ? 18 : 24;
  const verticalPadding = viewportWidth <= 760 ? 20 : 36;
  const stageTop = Math.floor(stage.getBoundingClientRect().top);

  return clampPage(viewportHeight - stageTop - bottomChrome - verticalPadding, 320, 980);
}

function getTouchDistance(touches: ReactTouchList) {
  const first = touches.item(0);
  const second = touches.item(1);

  if (!first || !second) {
    return 0;
  }

  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

function getTouchCenter(touches: ReactTouchList) {
  const first = touches.item(0);
  const second = touches.item(1);

  if (!first || !second) {
    return null;
  }

  return {
    x: (first.clientX + second.clientX) / 2,
    y: (first.clientY + second.clientY) / 2,
  };
}

type PdfPageCanvasProps = {
  fitMode?: 'contain' | 'height';
  pageTurnDirection: PageTurnDirection;
  pdfDocument: PDFDocumentProxy;
  page: number;
  targetHeight?: number;
  targetWidth: number;
  zoom: number;
  onDoubleClick?: () => void;
  onPageCommit?: () => void;
};

function PdfPageCanvas({ fitMode = 'contain', onDoubleClick, onPageCommit, page, pageTurnDirection, pdfDocument, targetHeight, targetWidth, zoom }: PdfPageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderIdRef = useRef(0);
  const lastRenderedPageRef = useRef<number | null>(null);
  const settleClassRef = useRef<'a' | 'b'>('a');
  const settleTimerRef = useRef<number | null>(null);
  const fallbackHeight = targetHeight ?? Math.round(targetWidth * 1.35);
  const [visibleSize, setVisibleSize] = useState(() => ({
    height: fallbackHeight,
    width: targetWidth,
  }));
  const [settleClass, setSettleClass] = useState<'a' | 'b' | ''>('');
  const [renderError, setRenderError] = useState('');

  useEffect(() => {
    return () => {
      if (settleTimerRef.current) {
        window.clearTimeout(settleTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    const renderId = renderIdRef.current + 1;
    renderIdRef.current = renderId;

    async function renderPage() {
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      setRenderError('');

      try {
        const pdfPage = await pdfDocument.getPage(page);

        if (cancelled) {
          return;
        }

        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const heightConstrainedWidth = targetHeight ? (targetHeight / baseViewport.height) * baseViewport.width : targetWidth;
        const fitWidth = fitMode === 'height' && targetHeight ? heightConstrainedWidth : Math.min(targetWidth, heightConstrainedWidth);
        const scale = (fitWidth * zoom) / baseViewport.width;
        const viewport = pdfPage.getViewport({ scale });
        const outputScale = window.devicePixelRatio || 1;
        const bufferCanvas = document.createElement('canvas');
        const bufferContext = bufferCanvas.getContext('2d');

        if (!bufferContext) {
          throw new Error('无法创建 PDF 画布。');
        }

        bufferCanvas.width = Math.floor(viewport.width * outputScale);
        bufferCanvas.height = Math.floor(viewport.height * outputScale);
        bufferContext.setTransform(outputScale, 0, 0, outputScale, 0, 0);
        renderTask = pdfPage.render({ canvas: bufferCanvas, canvasContext: bufferContext, viewport });
        await renderTask.promise;

        if (cancelled || renderIdRef.current !== renderId) {
          return;
        }

        const visibleContext = canvas.getContext('2d');

        if (!visibleContext) {
          throw new Error('无法创建 PDF 画布。');
        }

        canvas.width = bufferCanvas.width;
        canvas.height = bufferCanvas.height;
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        visibleContext.setTransform(1, 0, 0, 1, 0, 0);
        visibleContext.drawImage(bufferCanvas, 0, 0);
        setVisibleSize({
          height: Math.floor(viewport.height),
          width: Math.floor(viewport.width),
        });
        onPageCommit?.();

        const shouldAnimatePageTurn = lastRenderedPageRef.current !== null && lastRenderedPageRef.current !== page;
        lastRenderedPageRef.current = page;

        if (shouldAnimatePageTurn) {
          const nextSettleClass = settleClassRef.current === 'a' ? 'b' : 'a';
          settleClassRef.current = nextSettleClass;

          if (settleTimerRef.current) {
            window.clearTimeout(settleTimerRef.current);
          }

          setSettleClass(nextSettleClass);
          settleTimerRef.current = window.setTimeout(() => {
            setSettleClass('');
          }, 220);
        }
      } catch (error) {
        if (!cancelled && !(error instanceof Error && error.name === 'RenderingCancelledException')) {
          setRenderError(error instanceof Error ? error.message : 'PDF 页面渲染失败。');
        }
      }
    }

    void renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [fitMode, onPageCommit, page, pdfDocument, targetHeight, targetWidth, zoom]);

  const pageClassName = [
    'museum-pdf-page',
    settleClass ? 'museum-pdf-page-settling' : '',
    settleClass ? `museum-pdf-page-turn-${pageTurnDirection}` : '',
    settleClass ? `museum-pdf-page-settling-${settleClass}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={pageClassName}
      style={{
        '--museum-pdf-page-height': `${visibleSize.height}px`,
        '--museum-pdf-page-width': `${visibleSize.width}px`,
      } as CSSProperties}
    >
      {renderError ? <span className="museum-pdf-render-error">{renderError}</span> : null}
      <canvas
        className="museum-pdf-canvas"
        ref={canvasRef}
        style={{
          height: `${visibleSize.height}px`,
          width: `${visibleSize.width}px`,
        }}
        onDoubleClick={onDoubleClick}
      />
    </div>
  );
}

function MuseumPdfReader({ document, onBack, variant = 'desktop', work }: MuseumPdfReaderProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const immersiveStageRef = useRef<HTMLDivElement>(null);
  const wheelPageLockRef = useRef(0);
  const mobileGestureRef = useRef({
    centerRatioX: 0.5,
    centerRatioY: 0.5,
    initialDistance: 0,
    initialZoom: 1,
    isPinching: false,
    startScrollLeft: 0,
    startScrollTop: 0,
    startTime: 0,
    startX: 0,
    startY: 0,
  });
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(() => getInitialMuseumPdfPage(work.id, document));
  const [pageDraft, setPageDraft] = useState(String(page));
  const [totalPages, setTotalPages] = useState(0);
  const [stageWidth, setStageWidth] = useState(860);
  const [stageHeight, setStageHeight] = useState(680);
  const [immersiveStageWidth, setImmersiveStageWidth] = useState(1040);
  const [immersiveStageHeight, setImmersiveStageHeight] = useState(760);
  const [readerZoom] = useState(1);
  const [immersiveZoom, setImmersiveZoom] = useState(1);
  const [isImmersiveOpen, setIsImmersiveOpen] = useState(false);
  const [pageTurnDirection, setPageTurnDirection] = useState<PageTurnDirection>('jump');
  const [loadProgress, setLoadProgress] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const maxReadablePage = useMemo(
    () => (totalPages ? Math.min(document.pageEnd, totalPages) : document.pageEnd),
    [document.pageEnd, totalPages],
  );
  const canGoPrevious = page > document.pageStart;
  const canGoNext = page < maxReadablePage;

  useEffect(() => {
    setPdfDocument(null);
    setTotalPages(0);
    setErrorMessage('');
    setLoadProgress('');
    setIsLoading(true);
    setIsImmersiveOpen(false);
    setImmersiveZoom(1);
    setPageTurnDirection('jump');
    const nextPage = getInitialMuseumPdfPage(work.id, document);
    setPage(nextPage);
    setPageDraft(String(nextPage));
  }, [document, work.id]);

  useEffect(() => {
    const stage = stageRef.current;

    if (!stage) {
      return;
    }

    const updateStageFit = (width: number) => {
      setStageWidth(clampPage(width - 36, 320, 980));
      setStageHeight(getReaderFitHeight(stage));
    };

    const observer = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width);
      updateStageFit(width);
    });

    const handleViewportResize = () => updateStageFit(stage.getBoundingClientRect().width);

    observer.observe(stage);
    handleViewportResize();
    window.addEventListener('resize', handleViewportResize);
    window.visualViewport?.addEventListener('resize', handleViewportResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleViewportResize);
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
    };
  }, []);

  useEffect(() => {
    if (!isImmersiveOpen) {
      return;
    }

    const stage = immersiveStageRef.current;

    if (!stage) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width);
      const height = Math.floor(entry.contentRect.height);
      setImmersiveStageWidth(clampPage(width, 360, 1800));
      setImmersiveStageHeight(clampPage(height, 320, Math.max(1200, height)));
    });

    observer.observe(stage);
    return () => observer.disconnect();
  }, [isImmersiveOpen]);

  useEffect(() => {
    let cancelled = false;
    const loadingTask = pdfjsLib.getDocument({
      url: document.file,
      disableAutoFetch: false,
      disableStream: false,
    });

    loadingTask.onProgress = (progress: OnProgressParameters) => {
      if (cancelled || !progress.total) {
        return;
      }

      setLoadProgress(`${Math.round((progress.loaded / progress.total) * 100)}%`);
    };

    loadingTask.promise
      .then((nextDocument) => {
        if (cancelled) {
          void nextDocument.cleanup();
          return;
        }

        setPdfDocument(nextDocument);
        setTotalPages(nextDocument.numPages);
        setPage((currentPage) => clampPage(currentPage, document.pageStart, Math.min(document.pageEnd, nextDocument.numPages)));
        setErrorMessage('');
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'PDF 加载失败。');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
      void loadingTask.destroy();
    };
  }, [document.file, document.pageEnd, document.pageStart]);

  useEffect(() => {
    setPageDraft(String(page));

    if (pdfDocument) {
      saveMuseumPdfProgress(work.id, document, page, totalPages);
    }
  }, [document, page, pdfDocument, totalPages, work.id]);

  function updatePage(nextPage: number) {
    const clampedPage = clampPage(nextPage, document.pageStart, maxReadablePage);

    if (clampedPage === page) {
      setPageDraft(String(clampedPage));
      return;
    }

    setPageTurnDirection(clampedPage === page + 1 ? 'next' : clampedPage === page - 1 ? 'previous' : 'jump');
    setPage(clampedPage);
    setPageDraft(String(clampedPage));

    if (variant === 'mobile' && isImmersiveOpen) {
      window.requestAnimationFrame(() => {
        immersiveStageRef.current?.scrollTo({ left: 0, top: 0 });
      });
    }
  }

  function commitPageDraft() {
    const parsedPage = Number(pageDraft);

    if (Number.isInteger(parsedPage)) {
      updatePage(parsedPage);
      return;
    }

    setPageDraft(String(page));
  }

  function updateImmersiveZoom(delta: number) {
    setImmersiveZoom((currentZoom) => clampZoom(Math.round((currentZoom + delta) * 100) / 100));
  }

  function fitImmersiveToScreen() {
    const fitSize = getImmersiveFitSize();

    setImmersiveZoom(1);
    setImmersiveStageWidth(fitSize.width);
    setImmersiveStageHeight(fitSize.height);
    window.requestAnimationFrame(() => {
      immersiveStageRef.current?.scrollTo({ left: 0, top: 0 });
    });
  }

  function openImmersiveViewer() {
    fitImmersiveToScreen();
    setIsImmersiveOpen(true);
  }

  function centerImmersiveAtRatio(ratioX: number, ratioY: number) {
    const stage = immersiveStageRef.current;

    if (!stage) {
      return;
    }

    const centerStage = () => {
      stage.scrollTo({
        left: Math.max(0, stage.scrollWidth * ratioX - stage.clientWidth / 2),
        top: Math.max(0, stage.scrollHeight * ratioY - stage.clientHeight / 2),
      });
    };

    centerStage();
    window.setTimeout(centerStage, 80);
    window.setTimeout(centerStage, 180);
    window.setTimeout(centerStage, 360);
  }

  function handleMobileImmersiveTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (variant !== 'mobile' || !isImmersiveOpen) {
      return;
    }

    const stage = immersiveStageRef.current;
    const firstTouch = event.touches.item(0);

    if (!stage || !firstTouch) {
      return;
    }

    if (event.touches.length === 2) {
      const center = getTouchCenter(event.touches);
      const stageRect = stage.getBoundingClientRect();

      if (!center) {
        return;
      }

      event.preventDefault();
      mobileGestureRef.current = {
        centerRatioX: clampPage((stage.scrollLeft + center.x - stageRect.left) / Math.max(stage.scrollWidth, 1), 0, 1),
        centerRatioY: clampPage((stage.scrollTop + center.y - stageRect.top) / Math.max(stage.scrollHeight, 1), 0, 1),
        initialDistance: Math.max(getTouchDistance(event.touches), 1),
        initialZoom: immersiveZoom,
        isPinching: true,
        startScrollLeft: stage.scrollLeft,
        startScrollTop: stage.scrollTop,
        startTime: window.performance.now(),
        startX: center.x,
        startY: center.y,
      };
      return;
    }

    mobileGestureRef.current = {
      ...mobileGestureRef.current,
      isPinching: false,
      startScrollLeft: stage.scrollLeft,
      startScrollTop: stage.scrollTop,
      startTime: window.performance.now(),
      startX: firstTouch.clientX,
      startY: firstTouch.clientY,
    };
  }

  function handleMobileImmersiveTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (variant !== 'mobile' || !isImmersiveOpen || event.touches.length !== 2) {
      return;
    }

    const gesture = mobileGestureRef.current;

    if (!gesture.isPinching || !gesture.initialDistance) {
      return;
    }

    event.preventDefault();

    const nextZoom = clampZoom(Math.round(gesture.initialZoom * (getTouchDistance(event.touches) / gesture.initialDistance) * 100) / 100);
    setImmersiveZoom(nextZoom);
    window.requestAnimationFrame(() => centerImmersiveAtRatio(gesture.centerRatioX, gesture.centerRatioY));
  }

  function handleMobileImmersiveTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (variant !== 'mobile' || !isImmersiveOpen) {
      return;
    }

    const gesture = mobileGestureRef.current;
    const stage = immersiveStageRef.current;

    if (!stage) {
      return;
    }

    if (gesture.isPinching) {
      mobileGestureRef.current = { ...gesture, isPinching: event.touches.length > 1 };
      return;
    }

    const touch = event.changedTouches.item(0);

    if (!touch) {
      return;
    }

    const deltaX = touch.clientX - gesture.startX;
    const deltaY = touch.clientY - gesture.startY;
    const isHorizontalSwipe = Math.abs(deltaX) > 56 && Math.abs(deltaX) > Math.abs(deltaY) * 1.35;

    if (!isHorizontalSwipe || window.performance.now() - gesture.startTime > 700) {
      return;
    }

    const canTurnWhileZoomed = immersiveZoom <= 1.05;

    if (canTurnWhileZoomed) {
      event.preventDefault();
      updatePage(deltaX < 0 ? page + 1 : page - 1);
    }
  }

  function handleImmersiveWheel(event: WheelEvent<HTMLDivElement>) {
    if (!pdfDocument || errorMessage) {
      return;
    }

    event.preventDefault();

    if (Math.abs(event.deltaY) < 8) {
      return;
    }

    const now = window.performance.now();

    if (now - wheelPageLockRef.current < 320) {
      return;
    }

    wheelPageLockRef.current = now;
    updatePage(event.deltaY > 0 ? page + 1 : page - 1);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableShortcutTarget(event.target)) {
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      switch (event.key) {
        case 'Escape':
          if (isImmersiveOpen) {
            event.preventDefault();
            setIsImmersiveOpen(false);
          }
          break;
        case 'ArrowLeft':
        case 'PageUp':
          event.preventDefault();
          updatePage(page - 1);
          break;
        case 'ArrowRight':
        case 'PageDown':
          event.preventDefault();
          updatePage(page + 1);
          break;
        case ' ':
          event.preventDefault();
          updatePage(event.shiftKey ? page - 1 : page + 1);
          break;
        case 'Home':
          event.preventDefault();
          updatePage(document.pageStart);
          break;
        case 'End':
          event.preventDefault();
          updatePage(maxReadablePage);
          break;
        default:
          if (event.key.toLowerCase() === 'f' && pdfDocument && !errorMessage && !isImmersiveOpen) {
            event.preventDefault();
            openImmersiveViewer();
          }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <section className={`museum-pdf-reader ${variant === 'mobile' ? 'mobile' : ''}`} aria-label={`${work.title} PDF 阅读器`}>
      <header className="museum-pdf-reader-head">
        <button type="button" onClick={onBack} title="返回资料馆">
          <ArrowLeft size={17} aria-hidden="true" />
          返回资料馆
        </button>
        <div>
          <p className="eyebrow">{work.title}</p>
          <h2>{document.title}</h2>
          <span>
            文献范围 {document.pageStart}-{maxReadablePage} 页
          </span>
        </div>
        <a href={`${document.file}#page=${page}`} rel="noreferrer" target="_blank" title="在新标签打开">
          <ExternalLink size={16} aria-hidden="true" />
          新标签打开
        </a>
      </header>

      <div className="museum-pdf-toolbar" aria-label="PDF 翻页工具">
        <button type="button" disabled={!canGoPrevious || isLoading} onClick={() => updatePage(page - 1)} title="上一页 (← / PageUp)">
          <ChevronLeft size={17} aria-hidden="true" />
          上一页
        </button>
        <label>
          <FileText size={16} aria-hidden="true" />
          <input
            aria-label="当前 PDF 页码"
            inputMode="numeric"
            value={pageDraft}
            onBlur={commitPageDraft}
            onChange={(event) => setPageDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commitPageDraft();
              }
            }}
          />
          <span>/ {maxReadablePage}</span>
        </label>
        <button type="button" disabled={!canGoNext || isLoading} onClick={() => updatePage(page + 1)} title="下一页 (→ / PageDown / Space)">
          下一页
          <ChevronRight size={17} aria-hidden="true" />
        </button>
        <button type="button" disabled={!pdfDocument || Boolean(errorMessage)} onClick={openImmersiveViewer} title="放大浏览 (F / 双击 PDF)">
          <Maximize2 size={17} aria-hidden="true" />
          放大浏览
        </button>
      </div>

      <div className="museum-pdf-stage" ref={stageRef}>
        {isLoading ? (
          <div className="museum-pdf-state">
            <p className="eyebrow">loading archive</p>
            <strong>正在读取 PDF{loadProgress ? ` · ${loadProgress}` : ''}</strong>
          </div>
        ) : errorMessage ? (
          <div className="museum-pdf-state">
            <p className="eyebrow">reader error</p>
            <strong>PDF 无法显示</strong>
            <span>{errorMessage}</span>
            <a href={`${document.file}#page=${page}`} rel="noreferrer" target="_blank">
              在新标签打开 PDF
            </a>
          </div>
        ) : (
          <>
            {pdfDocument ? (
              <PdfPageCanvas
                pdfDocument={pdfDocument}
                page={page}
                pageTurnDirection={pageTurnDirection}
                targetHeight={stageHeight}
                targetWidth={stageWidth}
                zoom={readerZoom}
                onDoubleClick={openImmersiveViewer}
              />
            ) : null}
          </>
        )}
      </div>

      {isImmersiveOpen && pdfDocument ? (
        <div className="museum-pdf-immersive" role="dialog" aria-label={`${document.title} 沉浸式 PDF 浏览`} aria-modal="true">
          <div className="museum-pdf-immersive-head">
            <button type="button" onClick={() => setIsImmersiveOpen(false)} title="关闭 (Esc)">
              <X size={17} aria-hidden="true" />
              关闭
            </button>
          </div>
          {variant === 'mobile' ? null : (
            <div className="museum-pdf-immersive-dock" aria-label="沉浸式 PDF 控制器">
              <button
                type="button"
                aria-label="上一页"
                disabled={!canGoPrevious}
                onClick={() => updatePage(page - 1)}
                title="上一页 (← / PageUp / Shift+Space)"
              >
                <ChevronLeft size={17} aria-hidden="true" />
              </button>
              <label className="museum-pdf-immersive-page-control">
                <input
                  aria-label="沉浸式当前 PDF 页码"
                  inputMode="numeric"
                  value={pageDraft}
                  onBlur={commitPageDraft}
                  onChange={(event) => setPageDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      commitPageDraft();
                    }
                  }}
                />
                <span>/ {maxReadablePage}</span>
              </label>
              <button
                type="button"
                aria-label="下一页"
                disabled={!canGoNext}
                onClick={() => updatePage(page + 1)}
                title="下一页 (→ / PageDown / Space)"
              >
                <ChevronRight size={17} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="缩小"
                disabled={immersiveZoom <= 0.75}
                onClick={() => updateImmersiveZoom(-0.25)}
                title="缩小"
              >
                <Minus size={17} aria-hidden="true" />
              </button>
              <button type="button" aria-label="适配屏幕" onClick={fitImmersiveToScreen} title="适配屏幕">
                <RotateCcw size={17} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="放大"
                disabled={immersiveZoom >= 2.5}
                onClick={() => updateImmersiveZoom(0.25)}
                title="放大"
              >
                <Plus size={17} aria-hidden="true" />
              </button>
            </div>
          )}

          <div
            className="museum-pdf-immersive-stage"
            ref={immersiveStageRef}
            onTouchStart={handleMobileImmersiveTouchStart}
            onTouchMove={handleMobileImmersiveTouchMove}
            onTouchEnd={handleMobileImmersiveTouchEnd}
            onWheel={handleImmersiveWheel}
          >
            <PdfPageCanvas
              fitMode={variant === 'mobile' ? 'contain' : 'height'}
              pdfDocument={pdfDocument}
              page={page}
              pageTurnDirection={pageTurnDirection}
              targetHeight={immersiveStageHeight}
              targetWidth={immersiveStageWidth}
              zoom={immersiveZoom}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default MuseumPdfReader;
