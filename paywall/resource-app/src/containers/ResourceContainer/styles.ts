import styled from 'styled-components';

export const StyledContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding: 48px 20px 80px;
`;

export const ContentGrid = styled.div`
  width: min(1200px, 100%);
  display: grid;
  gap: 32px;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
`;

export const Hero = styled.section`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

export const ReturnLink = styled.a`
  align-self: flex-start;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(125, 188, 225, 0.3);
  background: rgba(8, 12, 24, 0.45);
  color: var(--text);
  font-weight: 600;
  text-decoration: none;
  transition: border 0.2s ease, color 0.2s ease;

  &:hover {
    border-color: rgba(8, 241, 255, 0.5);
    color: #08f1ff;
  }
`;

export const Badge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(8, 241, 255, 0.2), rgba(91, 107, 255, 0.2));
  border: 1px solid rgba(8, 241, 255, 0.28);
  color: var(--aqua-strong);
  font-weight: 600;
  letter-spacing: 0.2px;
  width: fit-content;
`;

export const Title = styled.h1`
  font-family: 'Urbanist', sans-serif;
  font-size: clamp(2.4rem, 4vw, 3.6rem);
  line-height: 1.05;
  margin: 0;
`;

export const Subtitle = styled.p`
  margin: 0;
  color: var(--muted);
  font-size: 1.05rem;
  max-width: 560px;
`;

export const StatRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
`;

export const StatCard = styled.div`
  padding: 14px 18px;
  border-radius: 14px;
  background: rgba(18, 26, 46, 0.7);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  min-width: 170px;
`;

export const StatLabel = styled.div`
  color: var(--muted);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
`;

export const StatValue = styled.div`
  font-size: 1.4rem;
  font-weight: 600;
`;

export const Panel = styled.section`
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 22px;
  padding: 28px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(14px);
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

export const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

export const PanelTitle = styled.h2`
  margin: 0;
  font-size: 1.4rem;
  font-family: 'Urbanist', sans-serif;
`;

export const StatusPill = styled.div<{ tone?: 'neutral' | 'success' | 'warn' }>`
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 0.85rem;
  color: ${({ tone }) => (tone === 'success' ? '#081616' : '#071017')};
  background: ${({ tone }) =>
    tone === 'success'
      ? 'linear-gradient(90deg, #16e0a0, #08f1ff)'
      : tone === 'warn'
        ? 'linear-gradient(90deg, #ffcf6a, #ff9f63)'
        : 'linear-gradient(90deg, rgba(8,241,255,0.4), rgba(91,107,255,0.4))'};
`;

export const PairGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

export const PairChip = styled.button<{ active?: boolean }>`
  border-radius: 999px;
  padding: 8px 14px;
  border: 1px solid ${({ active }) => (active ? 'rgba(8,241,255,0.6)' : 'transparent')};
  background: ${({ active }) =>
    active ? 'rgba(8, 241, 255, 0.2)' : 'rgba(14, 24, 43, 0.7)'};
  color: ${({ active }) => (active ? '#08f1ff' : 'var(--muted)')};
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: #08f1ff;
    border-color: rgba(8, 241, 255, 0.4);
  }
`;

export const PairInput = styled.input`
  width: 100%;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(125, 188, 225, 0.2);
  background: rgba(10, 18, 34, 0.85);
  color: var(--text);
  font-size: 1rem;

  &::placeholder {
    color: rgba(154, 176, 200, 0.7);
  }
`;

export const ButtonRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
`;

export const PrimaryButton = styled.button<{ disabled?: boolean }>`
  flex: 1;
  min-width: 200px;
  padding: 12px 18px;
  border-radius: 14px;
  border: none;
  background: linear-gradient(120deg, #08f1ff, #5b6bff);
  color: #051219;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
    box-shadow: none;
  }

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 25px rgba(8, 241, 255, 0.3);
  }
`;

export const GhostButton = styled.button`
  min-width: 200px;
  padding: 12px 18px;
  border-radius: 14px;
  border: 1px solid rgba(125, 188, 225, 0.25);
  background: rgba(8, 12, 24, 0.5);
  color: var(--text);
  font-weight: 600;
  cursor: pointer;
  transition: border 0.2s ease;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    border-color: rgba(8, 241, 255, 0.4);
  }
`;

export const Steps = styled.div`
  display: grid;
  gap: 10px;
`;

export const StepItem = styled.div<{ active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: ${({ active }) => (active ? 'rgba(8, 241, 255, 0.16)' : 'rgba(10, 18, 34, 0.6)')};
  border: 1px solid ${({ active }) => (active ? 'rgba(8, 241, 255, 0.4)' : 'transparent')};
  color: ${({ active }) => (active ? '#08f1ff' : 'var(--muted)')};
  font-weight: 600;
`;

export const ResultCard = styled.div`
  padding: 16px;
  border-radius: 16px;
  background: rgba(10, 18, 34, 0.7);
  border: 1px solid rgba(125, 188, 225, 0.2);
`;

export const ResultLabel = styled.div`
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.7rem;
  color: var(--muted);
  margin-bottom: 10px;
`;

export const MetaRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--muted);
  font-size: 0.9rem;
`;

export const MetaItem = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
`;

export const MetaKey = styled.span`
  color: var(--muted);
  font-weight: 600;
`;

export const MetaValue = styled.span`
  color: var(--text);
`;

export const MetaLink = styled.a`
  color: var(--aqua-strong);
  font-weight: 600;
  word-break: break-all;
  text-decoration: underline;
`;
