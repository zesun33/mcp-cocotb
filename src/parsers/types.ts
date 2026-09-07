export type TestStatus = "pass" | "fail" | "error" | "skip";

export interface TestCaseResult {
  name: string;
  classname: string;
  timeSeconds: number;
  status: TestStatus;
  failureMessage?: string;
  failureType?: string;
  traceback?: string;
}

export interface CocotbRunResult {
  success: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  durationSeconds: number;
  simulator?: string;
  waveFiles?: string[];
  resultsXmlPath?: string;
  tests: TestCaseResult[];
  rawStdout: string;
  rawStderr: string;
  errors: string[];
}

export interface DiscoveredTest {
  name: string;
  line: number;
  docstring?: string;
}

export interface DiscoveryResult {
  file: string;
  moduleName: string;
  totalTests: number;
  tests: DiscoveredTest[];
}

export interface CocotbToolchainInfo {
  runtime: "podman" | "docker" | "host";
  image?: string;
  cocotbVersion: string;
  pythonVersion: string;
  simulator: string;
  verilator?: string;
}
