Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/trusty64"
  config.ssh.forward_agent = true
  config.vm.provision :shell, :path => "bootstrap.sh"
  config.vm.network :forwarded_port, host: 8000, guest: 8000, auto_correct: true
  config.vm.network :forwarded_port, host: 8001, guest: 80
  config.vm.network :forwarded_port, host: 8002, guest: 8002
  config.vm.network "private_network", ip: "192.168.42.42"

  config.vm.provider "virtualbox" do |v|
    v.memory = 3192
    v.cpus = 4
  end
end