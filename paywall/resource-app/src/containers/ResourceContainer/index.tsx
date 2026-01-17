import { useMemo, useState } from 'react';
import { DataViewer } from '../../components/DataViewer';
import { useX402Flow } from '../../hooks/useX402Flow';
import {
  Badge,
  ButtonRow,
  ContentGrid,
  GhostButton,
  Hero,
  MetaRow,
  MetaItem,
  MetaKey,
  MetaLink,
  MetaValue,
  PairChip,
  PairGrid,
  PairInput,
  Panel,
  PanelHeader,
  PanelTitle,
  PrimaryButton,
  ResultCard,
  ResultLabel,
  ReturnLink,
  StatCard,
  StatLabel,
  StatRow,
  StatValue,
  StatusPill,
  StepItem,
  Steps,
  StyledContainer,
  Subtitle,
  Title,
} from './styles';

export interface ResourceContainerProps {
  apiBase: string;
}

export function ResourceContainer(props: ResourceContainerProps): JSX.Element {
  const { status, data, paymentId, isBusy, fetchSecret, retryWithPaymentId } = useX402Flow({
    apiBase: props.apiBase,
  });
  const pairs = useMemo(() => ['WCRO-USDC'], []);
  const [pair, setPair] = useState<string>(pairs[0] ?? '');

  const payload = useMemo(() => {
    if (!data) return null;
    try {
      return JSON.parse(data) as {
        pair?: string;
        fairPrice?: string;
        fairPriceScaled?: string;
        confidenceScore?: string;
        confidenceScoreScaled?: string;
        maxSafeExecutionSize?: string;
        maxSafeExecutionSizeScaled?: string;
        flags?: string;
        sedaExplorerUrl?: string | null;
        cronosTxHash?: string | null;
        sedaRequestId?: string | null;
      };
    } catch {
      return null;
    }
  }, [data]);

  const cronosLink = payload?.cronosTxHash
    ? `https://explorer.cronos.org/testnet/tx/${payload.cronosTxHash}`
    : null;

  const activeStep = useMemo(() => {
    const norm = status.toLowerCase();
    if (norm.includes('requesting')) return 0;
    if (norm.includes('payment required')) return 1;
    if (norm.includes('signing')) return 2;
    if (norm.includes('sending')) return 3;
    if (norm.includes('access granted')) return 4;
    return -1;
  }, [status]);

  const tone = status.includes('Access granted')
    ? 'success'
    : status.includes('Payment required')
      ? 'warn'
      : 'neutral';

  return (
    <StyledContainer>
      <ContentGrid>
        <Hero>
          <ReturnLink href="/">Return to landing</ReturnLink>
          <Badge>VVS-styled x402 Oracle</Badge>
          <Title>Pay-per-query oracle pricing, with x402 on Cronos.</Title>
          <Subtitle>
            Choose a pair, request the price, and unlock access with an EIP-3009 payment. The flow
            is transparent: challenge, sign, settle, and fetch again.
          </Subtitle>
          <StatRow>
            <StatCard>
              <StatLabel>Protocol</StatLabel>
              <StatValue>x402 + EIP-3009</StatValue>
            </StatCard>
            <StatCard>
              <StatLabel>Network</StatLabel>
              <StatValue>Cronos Testnet</StatValue>
            </StatCard>
          </StatRow>
        </Hero>

        <Panel>
          <PanelHeader>
            <PanelTitle>Oracle Console</PanelTitle>
            <StatusPill tone={tone}>Status: {status || 'Idle'}</StatusPill>
          </PanelHeader>

          <div>
            <MetaRow>Pick a pair</MetaRow>
            <PairGrid>
              {pairs.map((item) => (
                <PairChip key={item} active={pair === item} onClick={() => setPair(item)}>
                  {item}
                </PairChip>
              ))}
            </PairGrid>
          </div>

          <PairInput
            value={pair}
            onChange={(event) => setPair(event.target.value.toUpperCase())}
            placeholder="WCRO-USDC only (MVP)"
          />

          <ButtonRow>
            <PrimaryButton onClick={() => void fetchSecret(pair)} disabled={isBusy}>
              {isBusy ? 'Working...' : 'Fetch Price'}
            </PrimaryButton>
            <GhostButton onClick={() => void retryWithPaymentId()} disabled={!paymentId || isBusy}>
              Retry with paymentId
            </GhostButton>
          </ButtonRow>

          <Steps>
            {['Request', '402 Challenge', 'Signature', 'Settlement', 'Unlocked'].map(
              (label, index) => (
                <StepItem key={label} active={index === activeStep}>
                  {index + 1}. {label}
                </StepItem>
              )
            )}
          </Steps>

          <ResultCard>
            <ResultLabel>Latest Payload</ResultLabel>
            <DataViewer data={data} />
            <MetaRow>
              <MetaItem>
                <MetaKey>Pair</MetaKey>
                <MetaValue>{payload?.pair ?? pair}</MetaValue>
              </MetaItem>
              <MetaItem>
                <MetaKey>Fair Price</MetaKey>
                <MetaValue>{payload?.fairPrice ?? '--'}</MetaValue>
              </MetaItem>
              <MetaItem>
                <MetaKey>Confidence</MetaKey>
                <MetaValue>{payload?.confidenceScore ?? '--'}</MetaValue>
              </MetaItem>
              <MetaItem>
                <MetaKey>Max Size</MetaKey>
                <MetaValue>{payload?.maxSafeExecutionSize ?? '--'}</MetaValue>
              </MetaItem>
              <MetaItem>
                <MetaKey>Flags</MetaKey>
                <MetaValue>{payload?.flags ?? '--'}</MetaValue>
              </MetaItem>
              <MetaItem>
                <MetaKey>SEDA</MetaKey>
                {payload?.sedaExplorerUrl ? (
                  <MetaLink href={payload.sedaExplorerUrl} target="_blank" rel="noreferrer">
                    View consensus
                  </MetaLink>
                ) : (
                  <MetaValue>--</MetaValue>
                )}
              </MetaItem>
              <MetaItem>
                <MetaKey>Cronos Tx</MetaKey>
                {cronosLink ? (
                  <MetaLink href={cronosLink} target="_blank" rel="noreferrer">
                    {payload?.cronosTxHash}
                  </MetaLink>
                ) : (
                  <MetaValue>--</MetaValue>
                )}
              </MetaItem>
              <MetaItem>
                <MetaKey>paymentId</MetaKey>
                <MetaValue>{paymentId || '--'}</MetaValue>
              </MetaItem>
            </MetaRow>
          </ResultCard>
        </Panel>
      </ContentGrid>
    </StyledContainer>
  );
}
