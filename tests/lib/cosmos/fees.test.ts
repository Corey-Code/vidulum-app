import { cosmosSimulateUrl } from '@/lib/cosmos/fees';

describe('cosmosSimulateUrl', () => {
  it('asks BeeZee REST directly', () => {
    expect(cosmosSimulateUrl('https://rest.getbze.com')).toBe(
      'https://rest.getbze.com/cosmos/tx/v1beta1/simulate'
    );
    expect(cosmosSimulateUrl('https://rest.getbze.com/')).toBe(
      'https://rest.getbze.com/cosmos/tx/v1beta1/simulate'
    );
    expect(cosmosSimulateUrl('https://rest.getbze.com')).not.toContain('api.vidulum.app');
  });
});
