export type SchedulerInputs = {
  availabilityXlsx: Buffer;     // "Provider Availability.xlsx"
  contractXlsx: Buffer;         // "Provider Contract.xlsx"
  credentialingXlsx: Buffer;    // "Provider Credentialing.xlsx"
  volumeXlsx: Buffer;    
  coverageXlsx: Buffer       // "Facility Volume.xlsx"
};

export function runScheduler(inputs: SchedulerInputs) {
   console.log("successs function")
}