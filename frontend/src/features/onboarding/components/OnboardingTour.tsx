import { XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { TourScenario } from "../tourScenarios";
import * as styles from "./OnboardingTour.css";

type OnboardingTourProps = {
  onClose: (result: "completed" | "skipped") => void;
  scenario: TourScenario;
};

type TargetRect = {
  height: number;
  left: number;
  top: number;
  width: number;
};

const targetPadding = 6;

/** 対象UIを強調しながら、画面操作を順番に案内します。 */
export function OnboardingTour({ onClose, scenario }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [targetMissing, setTargetMissing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = scenario.steps[stepIndex];
  const isLastStep = stepIndex === scenario.steps.length - 1;

  useEffect(() => {
    setStepIndex(0);
  }, [scenario.id]);

  useLayoutEffect(() => {
    if (!step) return;
    let cancelled = false;
    let retryCount = 0;
    let target: HTMLElement | null = null;
    let animationFrame = 0;

    function measureTarget() {
      target = document.querySelector<HTMLElement>(step.selector);
      if (!target) {
        retryCount += 1;
        if (retryCount < 30) {
          animationFrame = window.requestAnimationFrame(measureTarget);
          return;
        }
        if (!cancelled) {
          setTargetMissing(true);
          setTargetRect(null);
        }
        return;
      }

      target.scrollIntoView({ block: "nearest", inline: "nearest" });
      const rect = target.getBoundingClientRect();
      if (!cancelled) {
        setTargetMissing(false);
        setTargetRect({
          height: Math.max(rect.height + targetPadding * 2, 24),
          left: Math.max(rect.left - targetPadding, 4),
          top: Math.max(rect.top - targetPadding, 4),
          width: Math.max(rect.width + targetPadding * 2, 24),
        });
      }
    }

    function handleViewportChange() {
      retryCount = 0;
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(measureTarget);
    }

    setTargetRect(null);
    setTargetMissing(false);
    measureTarget();
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [step]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose("skipped");
      if (event.key === "ArrowRight") {
        if (isLastStep) onClose("completed");
        else setStepIndex((current) => Math.min(current + 1, scenario.steps.length - 1));
      }
      if (event.key === "ArrowLeft") setStepIndex((current) => Math.max(current - 1, 0));
    }

    window.addEventListener("keydown", handleKeyDown);
    cardRef.current?.focus();
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLastStep, onClose, scenario.steps.length]);

  if (!step) return null;
  const cardPosition = getCardPosition(targetRect);

  return (
    <div className={styles.root} data-tour-active={scenario.id}>
      {targetRect ? (
        <div
          aria-hidden="true"
          className={styles.spotlight}
          style={{
            height: targetRect.height,
            left: targetRect.left,
            top: targetRect.top,
            width: targetRect.width,
          }}
        />
      ) : null}
      <div
        aria-describedby="onboarding-tour-body"
        aria-label={`${scenario.title}: ${step.title}`}
        aria-modal="true"
        className={styles.card}
        ref={cardRef}
        role="dialog"
        style={cardPosition}
        tabIndex={-1}
      >
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>{scenario.title}</span>
            <h2 className={styles.title}>{step.title}</h2>
          </div>
          <button
            aria-label="ツアーを終了"
            className={styles.closeButton}
            onClick={() => onClose("skipped")}
            title="ツアーを終了"
            type="button"
          >
            <XMarkIcon />
          </button>
        </header>
        <p className={styles.body} id="onboarding-tour-body">
          {step.body}
        </p>
        {targetMissing ? (
          <p className={styles.missing}>この画面では対象を表示できないため、次へ進んでください。</p>
        ) : null}
        <div
          aria-label={`全${scenario.steps.length}ステップ中${stepIndex + 1}`}
          className={styles.progress}
          style={{ "--tour-step-count": scenario.steps.length } as CSSProperties}
        >
          {scenario.steps.map((item, index) => (
            <span
              className={`${styles.progressItem} ${index <= stepIndex ? styles.progressItemActive : ""}`}
              key={`${item.title}-${index}`}
            />
          ))}
        </div>
        <footer className={styles.footer}>
          <span className={styles.stepCount}>
            {stepIndex + 1} / {scenario.steps.length}
          </span>
          <div className={styles.actions}>
            <button
              className={styles.secondaryButton}
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((current) => Math.max(current - 1, 0))}
              type="button"
            >
              戻る
            </button>
            <button
              className={styles.primaryButton}
              onClick={() => {
                if (isLastStep) onClose("completed");
                else setStepIndex((current) => Math.min(current + 1, scenario.steps.length - 1));
              }}
              type="button"
            >
              {isLastStep ? "完了" : "次へ"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function getCardPosition(rect: TargetRect | null): CSSProperties {
  const cardWidth = 360;
  const estimatedCardHeight = 270;
  const gap = 14;
  if (!rect) {
    return {
      left: Math.max((window.innerWidth - cardWidth) / 2, 12),
      top: Math.max((window.innerHeight - estimatedCardHeight) / 2, 12),
    };
  }

  const spaceBelow = window.innerHeight - (rect.top + rect.height);
  const top =
    spaceBelow >= estimatedCardHeight + gap
      ? rect.top + rect.height + gap
      : Math.max(rect.top - estimatedCardHeight - gap, 12);
  const left = Math.min(Math.max(rect.left, 12), Math.max(window.innerWidth - cardWidth - 12, 12));
  return { left, top };
}
